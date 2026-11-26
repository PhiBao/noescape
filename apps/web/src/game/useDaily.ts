import { MostWantedAbi, sepoliaAddresses } from "@noescape/contracts/abi";
import { bit, isWalkableCell, reach, WALK } from "@noescape/engine";
import { useCallback, useEffect, useReducer, useState } from "react";
import { type Account, type Address, getContract, parseAbi } from "viem";
import { getOrCreateBurner } from "../chain/burner.ts";
import { publicClient, walletClientFor, withRetry } from "../chain/clients.ts";
import { mapError } from "../chain/errors.ts";
import { ensurePermits, publicDecrypt, userDecrypt } from "../chain/zama.ts";
import {
  type DailyEvent,
  type DailyOrders,
  type DailyPhase,
  dailyReducer,
  initialDailyState,
} from "./dailyMachine.ts";

const WRAPPER_ADDRESS: Address = "0x4E7B06D78965594eB5EF5414c357ca21E1554491";
const UNDERLYING_ADDRESS: Address = "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0";
const SETUP_AMOUNT = 100n * 10n ** 6n;
const OPERATOR_SECONDS = 30 * 24 * 60 * 60;

const wrapperAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function confidentialBalanceOf(address account) view returns (bytes32)",
]);
const underlyingAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 value) returns (bool)",
]);

export interface HunterPin {
  address: Address;
  cell: number;
}

export interface Sighting {
  cell: number;
  hour: string;
}

function currentDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function currentWatch(): number {
  return Math.floor(((Date.now() / 1000) % 86_400) / 1_800);
}

function hourOfWatch(watch: number): string {
  return `${String((watch * 0.5) % 24).padStart(2, "0")}:${watch % 2 === 0 ? "00" : "30"}`;
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getContracts(account: Account) {
  return {
    writer: getContract({
      address: sepoliaAddresses.MostWanted.address,
      abi: MostWantedAbi,
      client: walletClientFor(account),
    }),
    reader: getContract({
      address: sepoliaAddresses.MostWanted.address,
      abi: MostWantedAbi,
      client: publicClient,
    }),
    wrapper: getContract({
      address: WRAPPER_ADDRESS,
      abi: wrapperAbi,
      client: walletClientFor(account),
    }),
    underlying: getContract({
      address: UNDERLYING_ADDRESS,
      abi: underlyingAbi,
      client: walletClientFor(account),
    }),
  };
}

export function useDaily() {
  const [state, dispatch] = useReducer(dailyReducer, undefined, initialDailyState);
  const [message, setMessage] = useState("");
  const [address, setAddress] = useState<Address | null>(null);
  const [hunters, setHunters] = useState<HunterPin[]>([]);
  const [hunterCount, setHunterCount] = useState(0);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [myCode, setMyCode] = useState<number | null>(null);
  const [payout, setPayout] = useState<string | null>(null);

  const fail = useCallback((error: unknown, retryTo: DailyPhase) => {
    dispatch({ type: "FAILED", kind: mapError(error), retryTo });
  }, []);

  const hydrate = useCallback(async () => {
    const account = getOrCreateBurner();
    setAddress(account.address);
    const { reader } = getContracts(account);
    const day = currentDay();
    const opened = await reader.read.getDay([day]);
    setHunterCount(Number(opened.hunters));
    const hunter = await reader.read.getHunter([day, account.address]);
    const actions = await reader.read.actionsOf([day, 0n, 256n]);
    const seen = new Map<string, HunterPin>();
    for (const action of actions) {
      seen.set(action.hunter.toLowerCase(), {
        address: action.hunter,
        cell: Number(action.fromCell),
      });
    }
    seen.set(account.address.toLowerCase(), {
      address: account.address,
      cell: Number(hunter.cell),
    });
    setHunters([...seen.values()]);

    const reports: Sighting[] = [];
    for (let step = 1; step <= Number(opened.steps); step += 1) {
      try {
        const handle = await reader.read.stepReportOf([day, step]);
        const clear = await publicDecrypt([handle]);
        const report = Number(clear.clear[handle] ?? 0n);
        const camera = report >> 2;
        if (camera > 0) reports.push({ cell: camera, hour: hourOfWatch(step) });
      } catch {
        // A missing or delayed report is simply not shown yet.
      }
    }
    setSightings(reports);

    const mine = actions.filter(
      (action) => action.hunter.toLowerCase() === account.address.toLowerCase(),
    );
    const latest = mine.at(-1);
    if (latest?.searched && Number(latest.step) > 0) {
      try {
        await ensurePermits([sepoliaAddresses.MostWanted.address]);
        const clear = await userDecrypt([
          { encryptedValue: latest.code, contractAddress: sepoliaAddresses.MostWanted.address },
        ]);
        setMyCode(Number(clear[latest.code] ?? -1n));
      } catch {
        setMyCode(null);
      }
    } else {
      setMyCode(null);
    }

    dispatch({
      type: "HYDRATED",
      day,
      watch: currentWatch(),
      joined: hunter.joined,
      cell: Number(hunter.cell),
      lastWatch: Number(hunter.lastWatch),
      actions: Number(hunter.actions),
      status: Number(opened.status),
      winner: opened.winner === "0x0000000000000000000000000000000000000000" ? null : opened.winner,
      verified: opened.verified,
    });
  }, []);

  useEffect(() => {
    void hydrate().catch((error: unknown) => {
      setMessage(mapError(error));
      dispatch({ type: "KEY_READY" });
    });
  }, [hydrate]);

  async function send(event: DailyEvent) {
    dispatch(event);
  }

  async function setupTokens() {
    const account = getOrCreateBurner();
    const { underlying, wrapper } = getContracts(account);
    try {
      await send({ type: "MINT_STARTED" });
      const mint = await withRetry(() => underlying.write.mint([account.address, SETUP_AMOUNT]));
      await publicClient.waitForTransactionReceipt({ hash: mint });
      await send({ type: "MINT_DONE", tx: mint });
      await send({ type: "APPROVE_STARTED" });
      const approve = await withRetry(() =>
        underlying.write.approve([WRAPPER_ADDRESS, SETUP_AMOUNT]),
      );
      await publicClient.waitForTransactionReceipt({ hash: approve });
      await send({ type: "APPROVE_DONE", tx: approve });
      await send({ type: "WRAP_STARTED" });
      const wrap = await withRetry(() => wrapper.write.wrap([account.address, SETUP_AMOUNT]));
      await publicClient.waitForTransactionReceipt({ hash: wrap });
      await send({ type: "WRAP_DONE", tx: wrap });
      setMessage("");
    } catch (error) {
      fail(error, "idle");
    }
  }

  async function authorise() {
    const account = getOrCreateBurner();
    const { wrapper } = getContracts(account);
    try {
      await send({ type: "OPERATOR_STARTED" });
      const until = Math.floor(Date.now() / 1000) + OPERATOR_SECONDS;
      const operator = await withRetry(() =>
        wrapper.write.setOperator([sepoliaAddresses.MostWanted.address, until]),
      );
      await publicClient.waitForTransactionReceipt({ hash: operator });
      await send({ type: "OPERATOR_DONE", tx: operator });
      setMessage("");
    } catch (error) {
      fail(error, "idle");
    }
  }

  async function join() {
    const account = getOrCreateBurner();
    const { writer } = getContracts(account);
    try {
      await send({ type: "JOIN_STARTED" });
      const hash = await withRetry(() => writer.write.join());
      await publicClient.waitForTransactionReceipt({ hash });
      await hydrate();
      const hunter = await getContracts(account).reader.read.getHunter([
        currentDay(),
        account.address,
      ]);
      dispatch({ type: "JOIN_DONE", day: currentDay(), cell: Number(hunter.cell), tx: hash });
      setMessage("");
    } catch (error) {
      fail(error, "idle");
    }
  }

  async function setOrders(orders: DailyOrders) {
    dispatch({ type: "ORDERS_CHANGED", orders });
  }

  async function hunt() {
    const account = getOrCreateBurner();
    const { writer, reader } = getContracts(account);
    try {
      await send({ type: "HUNT_STARTED" });
      const hash = await withRetry(() => writer.write.hunt([state.orders.to, state.orders.search]));
      await publicClient.waitForTransactionReceipt({ hash });
      await send({ type: "HUNT_MINED", tx: hash });
      const day = currentDay();
      const actions = await reader.read.actionsOf([day, 0n, 256n]);
      const latest = actions
        .filter((action) => action.hunter.toLowerCase() === account.address.toLowerCase())
        .at(-1);
      if (latest === undefined) throw new Error("hunt action not found");
      const clear = await publicDecrypt([latest.caught]);
      const caught = (clear.clear[latest.caught] ?? 0n) === 1n;
      if (caught) {
        await send({ type: "CLAIM_STARTED" });
        const claim = await withRetry(() =>
          writer.write.claimCapture([day, BigInt(actions.indexOf(latest)), clear.abi, clear.proof]),
        );
        await publicClient.waitForTransactionReceipt({ hash: claim });
        dispatch({ type: "CLAIM_DONE", winner: account.address, tx: claim });
      } else {
        dispatch({ type: "HUNT_DECODED", watch: currentWatch(), actions: Number(latest.step) });
      }
      await hydrate();
      setMessage("");
    } catch (error) {
      fail(error, "planning");
    }
  }

  async function decryptPayout() {
    const account = getOrCreateBurner();
    const { wrapper } = getContracts(account);
    try {
      await ensurePermits([sepoliaAddresses.MostWanted.address, WRAPPER_ADDRESS]);
      const handle = await wrapper.read.confidentialBalanceOf([account.address]);
      const clear = await userDecrypt([
        { encryptedValue: handle, contractAddress: WRAPPER_ADDRESS },
      ]);
      setPayout(`${Number(clear[handle] ?? 0n) / 10 ** 6} cUSDT`);
    } catch (error) {
      setMessage(mapError(error));
    }
  }

  async function verifyDay() {
    if (state.day === null) return;
    const day = state.day;
    const account = getOrCreateBurner();
    const { writer, reader } = getContracts(account);
    try {
      const parts = await reader.read.revealPlan([day]);
      for (const part of parts) {
        const clear = await publicDecrypt([...part.handles]);
        const hash = await withRetry(() =>
          writer.write.submitDailyReveal([day, part.kind, part.start, clear.abi, clear.proof]),
        );
        await publicClient.waitForTransactionReceipt({ hash });
      }
      const opened = await reader.read.getDay([day]);
      if (opened.verified && opened.verifyOk) dispatch({ type: "VERIFIED" });
      else setMessage("Daily verification did not pass");
    } catch (error) {
      setMessage(mapError(error));
    }
  }

  function retry() {
    dispatch({ type: "RETRY" });
    void hydrate().catch((error: unknown) => setMessage(mapError(error)));
  }

  return {
    state,
    address,
    hunters,
    hunterCount,
    sightings,
    myCode,
    payout,
    message,
    setupTokens,
    authorise,
    join,
    setOrders,
    hunt,
    decryptPayout,
    verifyDay,
    retry,
    shortAddress,
    validOrder: (cell: number, search: boolean) =>
      isWalkableCell(cell) && (reach(bit(state.cell), search ? 2 : 3, WALK) & bit(cell)) !== 0n,
    canHunt: state.joined && state.watch > state.lastWatch && state.phase === "planning",
    watchLabel: hourOfWatch(state.watch),
    nextWatchSeconds: 1_800 - (Math.floor(Date.now() / 1000) % 1_800),
  };
}
