// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================
//  ERC-4337 BASE STORAGE CONTRACT — erc4337-kit
//  Copy this file, rename the contract, change the struct.
//  DO NOT remove or change anything marked [ERC-4337 RULE].
// =============================================================
//
//  WHAT THIS CONTRACT DOES:
//  Stores a SHA-256 hash of your data permanently on-chain.
//  The actual data never touches the blockchain — only the hash.
//  This gives you tamper-proof proof that data existed at a
//  specific time, without exposing any private content.
//
//  HOW ERC-4337 CALLS THIS CONTRACT:
//  Normal flow: User wallet → calls your contract
//  ERC-4337 flow: User wallet → Smart Account → EntryPoint → your contract
//
//  The key difference: msg.sender will NEVER be the user's real wallet
//  address. It will be their Smart Account address (a contract).
//  Keep this in mind when you design identity or access control.
//
// =============================================================

contract BaseStorage {

    // ---------------------------------------------------------
    //  DATA STRUCTURES
    //  Customize the Record struct for your use case.
    //  Examples: add locationHash, severity, category, etc.
    // ---------------------------------------------------------

    struct Record {
        bytes32 dataHash;       // SHA-256 hash of your actual data (computed in the frontend)
        uint256 timestamp;      // block.timestamp at submission — fine for ordering, not for security
        address submitter;      // [ERC-4337 RULE] This is the Smart Account address, NOT the user's EOA
        bool exists;            // guard for duplicate-check pattern
    }

    // ---------------------------------------------------------
    //  STATE
    // ---------------------------------------------------------

    // Primary lookup: unique ID → Record
    mapping(bytes32 => Record) private _records;

    // Reverse lookup: submitter address → all their record IDs
    // Lets you fetch "all records by this user" efficiently
    mapping(address => bytes32[]) private _submitterRecords;

    // Total count — useful for off-chain indexing
    uint256 public totalRecords;

    // ---------------------------------------------------------
    //  EVENTS
    //  Always emit events. Off-chain apps (your frontend, indexers)
    //  listen to these to know something happened without polling.
    // ---------------------------------------------------------

    event RecordStored(
        bytes32 indexed id,
        bytes32 indexed dataHash,
        address indexed submitter,
        uint256 timestamp
    );

    event RecordUpdated(
        bytes32 indexed id,
        bytes32 newDataHash,
        uint256 timestamp
    );

    // ---------------------------------------------------------
    //  ERRORS
    //  Custom errors use less gas than require strings.
    //  Use these instead of require("...") in production.
    // ---------------------------------------------------------

    error RecordAlreadyExists(bytes32 id);
    error RecordNotFound(bytes32 id);
    error NotSubmitter(address caller, address expected);

    // ---------------------------------------------------------
    //  WRITE FUNCTIONS
    // ---------------------------------------------------------

    /**
     * @notice Store a new record on-chain.
     *
     * @dev [ERC-4337 RULE] msg.sender here is the user's Smart Account,
     *      not their original EOA (e.g. Google-login wallet). If you need
     *      to track the original user, pass an identifier in calldata
     *      (like a hash of their email) and store it in the struct.
     *
     * @dev [ERC-4337 RULE] Do NOT do heavy computation here.
     *      Paymasters cap gas. If this function is too expensive,
     *      the UserOp will be rejected before it even reaches chain.
     *      Keep storage writes minimal. One SSTORE = ~20,000 gas.
     *
     * @param dataHash  SHA-256 hash computed in the frontend. Never send
     *                  raw data — only the hash belongs on-chain.
     *
     * @return id  Unique identifier for this record (use this to verify later)
     */
    function storeRecord(bytes32 dataHash) external returns (bytes32 id) {
        // Generate a deterministic ID from hash + block + sender
        // This makes IDs reproducible for the same input in the same block
        id = keccak256(abi.encodePacked(dataHash, block.timestamp, msg.sender));

        // Revert if this exact ID was already stored
        // (prevents accidental double-submit)
        if (_records[id].exists) revert RecordAlreadyExists(id);

        // Write to storage
        _records[id] = Record({
            dataHash:  dataHash,
            timestamp: block.timestamp,
            submitter: msg.sender,   // Smart Account address
            exists:    true
        });

        // Update reverse index
        _submitterRecords[msg.sender].push(id);
        totalRecords++;

        emit RecordStored(id, dataHash, msg.sender, block.timestamp);
    }

    // ---------------------------------------------------------
    //  READ FUNCTIONS
    //  These are free (no gas) — call them as often as you want.
    // ---------------------------------------------------------

    /**
     * @notice Get a record by ID.
     * @dev Returns all fields. Your frontend can use dataHash to
     *      verify against the original data the user still has.
     */
    function getRecord(bytes32 id)
        external
        view
        returns (
            bytes32 dataHash,
            uint256 timestamp,
            address submitter
        )
    {
        if (!_records[id].exists) revert RecordNotFound(id);
        Record storage r = _records[id];
        return (r.dataHash, r.timestamp, r.submitter);
    }

    /**
     * @notice Verify: does this record exist AND match the given hash?
     * @dev This is your tamper-proof check. If someone gives you
     *      the original data + a record ID, you hash the data and
     *      call this. If it returns true, the data is authentic.
     *
     * @param id        Record ID returned from storeRecord()
     * @param dataHash  SHA-256 hash you computed of the original data
     * @return bool     true = record exists and hash matches
     */
    function verifyRecord(bytes32 id, bytes32 dataHash)
        external
        view
        returns (bool)
    {
        if (!_records[id].exists) return false;
        return _records[id].dataHash == dataHash;
    }

    /**
     * @notice Get all record IDs submitted by a specific Smart Account.
     * @dev Pass the Smart Account address (not the user's EOA).
     *      Your frontend gets this from useSmartAccount().smartAccountAddress
     */
    function getRecordsBySubmitter(address submitter)
        external
        view
        returns (bytes32[] memory)
    {
        return _submitterRecords[submitter];
    }

    /**
     * @notice Check if a record exists without reverting.
     * @dev Useful for frontend validation before showing a verify button.
     */
    function recordExists(bytes32 id) external view returns (bool) {
        return _records[id].exists;
    }
}

// =============================================================
//  HOW TO CUSTOMIZE THIS CONTRACT
//
//  1. RENAME IT:
//     contract IncidentRegistry { ... }
//     contract DrugVerification { ... }
//     contract DocumentProof { ... }
//
//  2. ADD FIELDS TO THE STRUCT:
//     struct Record {
//         bytes32 dataHash;
//         uint256 timestamp;
//         address submitter;
//         bool exists;
//         // ADD YOUR FIELDS:
//         string locationHash;   // hashed GPS coords
//         uint8 severity;        // 1-5 scale
//         bytes32 category;      // incident type, drug type, etc.
//     }
//
//  3. UPDATE storeRecord() PARAMS:
//     function storeRecord(bytes32 dataHash, string calldata locationHash, uint8 severity)
//
//  4. THAT'S IT. The ERC-4337 rules above still apply.
//     You do NOT need to change anything about how UserOps work.
//     The SDK handles all of that.
// =============================================================
