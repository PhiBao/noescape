export const CaseRulesMostWantedAbi = [
  {
    inputs: [
      {
        internalType: "uint8[3]",
        name: "cells",
        type: "uint8[3]",
      },
      {
        internalType: "uint8[3]",
        name: "to",
        type: "uint8[3]",
      },
      {
        internalType: "uint8",
        name: "flags",
        type: "uint8",
      },
    ],
    name: "validOrders",
    outputs: [
      {
        internalType: "bool",
        name: "ok",
        type: "bool",
      },
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
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint128[]",
            name: "path",
            type: "uint128[]",
          },
          {
            internalType: "uint8",
            name: "exitIdx",
            type: "uint8",
          },
          {
            internalType: "uint8",
            name: "turnCount",
            type: "uint8",
          },
          {
            internalType: "uint8[3][]",
            name: "orders",
            type: "uint8[3][]",
          },
          {
            internalType: "uint8[]",
            name: "flags",
            type: "uint8[]",
          },
          {
            internalType: "uint8[]",
            name: "reports",
            type: "uint8[]",
          },
          {
            internalType: "uint8[]",
            name: "noise",
            type: "uint8[]",
          },
          {
            internalType: "uint8[]",
            name: "codes",
            type: "uint8[]",
          },
          {
            internalType: "uint8",
            name: "finalStatus",
            type: "uint8",
          },
        ],
        internalType: "struct CaseRules.Reveal",
        name: "r",
        type: "tuple",
      },
    ],
    name: "verifyCase",
    outputs: [
      {
        internalType: "bool",
        name: "ok",
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
        internalType: "uint16",
        name: "moves",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "answers",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "reportsCount",
        type: "uint16",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint128[]",
            name: "path",
            type: "uint128[]",
          },
          {
            internalType: "uint128[]",
            name: "detMasks",
            type: "uint128[]",
          },
          {
            internalType: "uint8[]",
            name: "noise",
            type: "uint8[]",
          },
          {
            internalType: "uint16[]",
            name: "hunters",
            type: "uint16[]",
          },
          {
            internalType: "uint8[]",
            name: "actionSteps",
            type: "uint8[]",
          },
          {
            internalType: "uint8[]",
            name: "fromCells",
            type: "uint8[]",
          },
          {
            internalType: "uint8[]",
            name: "toCells",
            type: "uint8[]",
          },
          {
            internalType: "bool[]",
            name: "searched",
            type: "bool[]",
          },
          {
            internalType: "uint8[]",
            name: "codes",
            type: "uint8[]",
          },
          {
            internalType: "uint16",
            name: "hunterCount",
            type: "uint16",
          },
          {
            internalType: "uint8",
            name: "finalStatus",
            type: "uint8",
          },
        ],
        internalType: "struct CaseRules.DailyReveal",
        name: "r",
        type: "tuple",
      },
    ],
    name: "verifyDaily",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
] as const;
