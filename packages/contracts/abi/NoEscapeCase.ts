export const NoEscapeCaseAbi = [
  {
    inputs: [],
    name: "AlreadyVerified",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "reason",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "detective",
        type: "uint8",
      },
    ],
    name: "BadOrders",
    type: "error",
  },
  {
    inputs: [],
    name: "BadRevealLength",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "CaseActive",
    type: "error",
  },
  {
    inputs: [],
    name: "CaseOver",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidKMSSignatures",
    type: "error",
  },
  {
    inputs: [],
    name: "NoTurns",
    type: "error",
  },
  {
    inputs: [],
    name: "NotActive",
    type: "error",
  },
  {
    inputs: [],
    name: "NotDetective",
    type: "error",
  },
  {
    inputs: [],
    name: "NotEnded",
    type: "error",
  },
  {
    inputs: [],
    name: "ReportPending",
    type: "error",
  },
  {
    inputs: [],
    name: "ZamaProtocolUnsupported",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "enum NoEscapeCase.Status",
        name: "status",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "turn",
        type: "uint8",
      },
    ],
    name: "CaseEnded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "detective",
        type: "address",
      },
    ],
    name: "CaseOpened",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "bool",
        name: "ok",
        type: "bool",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "failCode",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "failTurn",
        type: "uint8",
      },
    ],
    name: "CaseVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32[]",
        name: "handlesList",
        type: "bytes32[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "abiEncodedCleartexts",
        type: "bytes",
      },
    ],
    name: "PublicDecryptionVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "turn",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8[3]",
        name: "to",
        type: "uint8[3]",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "searchFlags",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "euint8",
        name: "report",
        type: "bytes32",
      },
    ],
    name: "TurnPlayed",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "abandonCase",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "detective",
        type: "address",
      },
    ],
    name: "activeCaseOf",
    outputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "confidentialProtocolId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "getCase",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "detective",
            type: "address",
          },
          {
            internalType: "enum NoEscapeCase.Status",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "turn",
            type: "uint8",
          },
          {
            internalType: "uint64",
            name: "openedAt",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "closedAt",
            type: "uint64",
          },
          {
            internalType: "euint128",
            name: "startPos",
            type: "bytes32",
          },
          {
            internalType: "euint128",
            name: "pos",
            type: "bytes32",
          },
          {
            internalType: "euint128",
            name: "p1",
            type: "bytes32",
          },
          {
            internalType: "euint128",
            name: "p2",
            type: "bytes32",
          },
          {
            internalType: "euint128",
            name: "trail",
            type: "bytes32",
          },
          {
            internalType: "euint8",
            name: "exitIdx",
            type: "bytes32",
          },
          {
            internalType: "bool",
            name: "verified",
            type: "bool",
          },
          {
            internalType: "bool",
            name: "verifyOk",
            type: "bool",
          },
          {
            internalType: "uint8",
            name: "failCode",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "failTurn",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "exitClear",
            type: "uint8",
          },
          {
            internalType: "uint128[]",
            name: "path",
            type: "uint128[]",
          },
          {
            internalType: "bytes",
            name: "noiseClear",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "codesClear",
            type: "bytes",
          },
        ],
        internalType: "struct NoEscapeCase.Case",
        name: "c",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "turn",
        type: "uint8",
      },
    ],
    name: "getTurn",
    outputs: [
      {
        components: [
          {
            internalType: "uint8[3]",
            name: "cells",
            type: "uint8[3]",
          },
          {
            internalType: "uint8",
            name: "searchFlags",
            type: "uint8",
          },
          {
            internalType: "euint8[3]",
            name: "codes",
            type: "bytes32[3]",
          },
          {
            internalType: "euint8[5]",
            name: "noise",
            type: "bytes32[5]",
          },
          {
            internalType: "euint128",
            name: "posAfter",
            type: "bytes32",
          },
          {
            internalType: "euint8",
            name: "report",
            type: "bytes32",
          },
          {
            internalType: "bool",
            name: "resolved",
            type: "bool",
          },
          {
            internalType: "uint8",
            name: "reportClear",
            type: "uint8",
          },
        ],
        internalType: "struct NoEscapeCase.Turn",
        name: "t",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "openCase",
    outputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "uint8[3]",
        name: "to",
        type: "uint8[3]",
      },
      {
        internalType: "uint8",
        name: "searchFlags",
        type: "uint8",
      },
      {
        internalType: "bytes",
        name: "prevClear",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "prevProof",
        type: "bytes",
      },
    ],
    name: "playTurn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "posHandle",
    outputs: [
      {
        internalType: "euint128",
        name: "handle",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "recentClosed",
    outputs: [
      {
        internalType: "uint256[32]",
        name: "ids",
        type: "uint256[32]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "clear",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "proof",
        type: "bytes",
      },
    ],
    name: "resolveReport",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "revealHandles",
    outputs: [
      {
        internalType: "bytes32[]",
        name: "a",
        type: "bytes32[]",
      },
      {
        internalType: "bytes32[]",
        name: "b",
        type: "bytes32[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "detective",
        type: "address",
      },
    ],
    name: "statsOf",
    outputs: [
      {
        internalType: "uint32",
        name: "opened",
        type: "uint32",
      },
      {
        internalType: "uint32",
        name: "caught",
        type: "uint32",
      },
      {
        internalType: "uint32",
        name: "escaped",
        type: "uint32",
      },
      {
        internalType: "uint32",
        name: "dawn",
        type: "uint32",
      },
      {
        internalType: "uint32",
        name: "abandoned",
        type: "uint32",
      },
      {
        internalType: "uint8",
        name: "bestTurn",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "clearA",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "proofA",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "clearB",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "proofB",
        type: "bytes",
      },
    ],
    name: "submitReveal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
