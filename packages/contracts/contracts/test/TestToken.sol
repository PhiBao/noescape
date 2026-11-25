// SPDX-License-Identifier: MIT

pragma solidity ^0.8.27;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title TestToken
/// @author noescape contributors
/// @notice OpenZeppelin ERC7984-style token for Hardhat tests only.
contract TestToken is ERC7984, ZamaEthereumConfig {
    /// @notice Creates the test token with six-decimal metadata.
    constructor() ERC7984("Test Confidential Token", "TEST", "") {}

    /// @notice Mints test tokens to an address.
    /// @param to Recipient address.
    /// @param amount Amount in the token's smallest unit.
    function mint(address to, uint64 amount) external {
        _mint(to, FHE.asEuint64(amount));
    }
}
