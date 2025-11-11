// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RootSeal {
    address public owner;
    bytes32 public merkleRoot;
    string public description;
    bool public isLocked;

    event MerkleRootUpdated(bytes32 newRoot, string description);
    event ContractLocked();

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(bytes32 _root, string memory _description) {
        owner = msg.sender;
        merkleRoot = _root;
        description = _description;
        emit MerkleRootUpdated(_root, _description);
    }

    function setMerkleRoot(bytes32 _root, string memory _description) external onlyOwner {
        require(!isLocked, "Contract is locked");
        merkleRoot = _root;
        description = _description;
        emit MerkleRootUpdated(_root, _description);
    }

    function lock() external onlyOwner {
        require(!isLocked, "Already locked");
        isLocked = true;
        emit ContractLocked();
    }
}
