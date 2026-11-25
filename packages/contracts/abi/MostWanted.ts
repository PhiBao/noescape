export const MostWantedAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "token_",
        type: "address",
      },
      {
        internalType: "uint64",
        name: "fee_",
        type: "uint64",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "AlreadyJoined",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadySubmitted",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadyVerified",
    type: "error",
  },
  {
    inputs: [],
    name: "BadAction",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "reason",
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
    inputs: [],
    name: "BadRevealPart",
    type: "error",
  },
  {
    inputs: [],
    name: "DayFull",
    type: "error",
  },
  {
    inputs: [],
    name: "DayOver",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidKMSSignatures",
    type: "error",
  },
  {
    inputs: [],
    name: "NotEnded",
    type: "error",
  },
  {
    inputs: [],
    name: "NotJoined",
    type: "error",
  },
  {
    inputs: [],
    name: "NotStarted",
    type: "error",
  },
  {
    inputs: [],
    name: "OncePerWatch",
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
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        indexed: true,
        internalType: "uint8",
        name: "status",
        type: "uint8",
      },
    ],
    name: "DayClosed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
    ],
    name: "DayOpened",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint32",
        name: "day",
        type: "uint32",
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
    ],
    name: "DayVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "actionIdx",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "hunter",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "step",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "fromCell",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "toCell",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "searched",
        type: "bool",
      },
    ],
    name: "Hunted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "hunter",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "cell",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint16",
        name: "hunterNo",
        type: "uint16",
      },
    ],
    name: "HunterJoined",
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
    inputs: [],
    name: "FEE",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "TOKEN",
    outputs: [
      {
        internalType: "contract IERC7984",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        internalType: "uint256",
        name: "from",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "count",
        type: "uint256",
      },
    ],
    name: "actionsOf",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "hunter",
            type: "address",
          },
          {
            internalType: "uint8",
            name: "step",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "fromCell",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "toCell",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "searched",
            type: "bool",
          },
          {
            internalType: "euint8",
            name: "code",
            type: "bytes32",
          },
          {
            internalType: "ebool",
            name: "caught",
            type: "bytes32",
          },
          {
            internalType: "bool",
            name: "resolved",
            type: "bool",
          },
        ],
        internalType: "struct MostWanted.Action[]",
        name: "page",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        internalType: "uint256",
        name: "actionIdx",
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
    name: "claimCapture",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
    ],
    name: "closeDay",
    outputs: [],
    stateMutability: "nonpayable",
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
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
    ],
    name: "getDay",
    outputs: [
      {
        components: [
          {
            internalType: "uint32",
            name: "day",
            type: "uint32",
          },
          {
            internalType: "uint8",
            name: "status",
            type: "uint8",
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
            internalType: "euint128",
            name: "startPos",
            type: "bytes32",
          },
          {
            internalType: "uint8",
            name: "steps",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "lastStepWatch",
            type: "uint8",
          },
          {
            internalType: "address",
            name: "winner",
            type: "address",
          },
          {
            internalType: "uint16",
            name: "hunters",
            type: "uint16",
          },
          {
            internalType: "euint64",
            name: "pot",
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
        ],
        internalType: "struct MostWanted.Day",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        internalType: "address",
        name: "hunter",
        type: "address",
      },
    ],
    name: "getHunter",
    outputs: [
      {
        components: [
          {
            internalType: "uint8",
            name: "cell",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "lastWatch",
            type: "uint8",
          },
          {
            internalType: "bool",
            name: "joined",
            type: "bool",
          },
          {
            internalType: "ebool",
            name: "paid",
            type: "bytes32",
          },
          {
            internalType: "uint16",
            name: "actions",
            type: "uint16",
          },
        ],
        internalType: "struct MostWanted.Hunter",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "to",
        type: "uint8",
      },
      {
        internalType: "bool",
        name: "search",
        type: "bool",
      },
    ],
    name: "hunt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "join",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
    ],
    name: "revealPlan",
    outputs: [
      {
        components: [
          {
            internalType: "uint8",
            name: "kind",
            type: "uint8",
          },
          {
            internalType: "uint16",
            name: "start",
            type: "uint16",
          },
          {
            internalType: "bytes32[]",
            name: "handles",
            type: "bytes32[]",
          },
        ],
        internalType: "struct MostWanted.RevealPart[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        internalType: "uint8",
        name: "step",
        type: "uint8",
      },
    ],
    name: "stepReportOf",
    outputs: [
      {
        internalType: "euint8",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "day",
        type: "uint32",
      },
      {
        internalType: "uint8",
        name: "kind",
        type: "uint8",
      },
      {
        internalType: "uint16",
        name: "start",
        type: "uint16",
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
    name: "submitDailyReveal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
