// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * OliveChainPool
 * ---------------
 * Smart contract mta3 il-hackathon "Hedera Cross Campus Challenge 2026".
 *
 * Logique:
 *  - Il-agriculteur (farmer) y-depositi collateral (huile d'olive tokenisée via HTS,
 *    valeur en "USDC units" — 6 decimales, mémé unité bil stablecoin token).
 *  - Y-9adir yetlob prêt jusqu'à 70% (LTV) mel valeur du collateral.
 *  - L'intérêt du prêt (9% APR) yet7esseb linéairement selon block.timestamp.
 *  - L'investisseur y-supply fi pool de liquidité w yeksib rendement (8.1% APY).
 *
 * Modèle "custodial": kol les opérations el-financières réelles (mint/transfer HTS)
 * ysiirou mel backend Node.js via l'operator account. Hedhi il-contract ye5dem comme
 * "source of truth" on-chain — accountId (string) houwa l'identifiant logique (Hedera
 * Account ID mte3 l'utilisateur), pas msg.sender, 3ala 5atir il-operator houwa
 * l-seul li y-appelli il-contract (onlyOperator).
 */
contract OliveChainPool {
    address public operator;

    struct Position {
        uint256 collateralValueUsdc; // valeur totale du collatéral (6 décimales)
        uint256 loanPrincipal; // capital emprunté en cours
        uint256 loanStart; // timestamp du début du prêt (0 si aucun)
        bool hasLoan;
        uint256 supplied; // montant fourni au pool
        uint256 supplyStart; // timestamp du dépôt dans le pool
    }

    mapping(bytes32 => Position) private positions;

    uint256 public constant LTV_BPS = 7000; // 70% en points de base
    uint256 public constant BORROW_APR_BPS = 900; // 9% annuel
    uint256 public constant POOL_APY_BPS = 810; // 8.1% annuel
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant YEAR_SECONDS = 365 days;

    uint256 public poolTotalSupplied;

    event CollateralDeposited(string accountId, uint256 valueUsdc, uint256 totalCollateral);
    event LoanIssued(string accountId, uint256 amount, uint256 totalPrincipal);
    event LoanRepaid(string accountId, uint256 amountRepaid);
    event Supplied(string accountId, uint256 amount, uint256 totalSupplied);
    event Withdrawn(string accountId, uint256 amount);
    event OperatorChanged(address previousOperator, address newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "OliveChain: caller is not operator");
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    function setOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "OliveChain: zero address");
        emit OperatorChanged(operator, newOperator);
        operator = newOperator;
    }

    function _key(string calldata accountId) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(accountId));
    }

    // ---------------------------------------------------------------------
    // Collatéral
    // ---------------------------------------------------------------------

    function depositCollateral(string calldata accountId, uint256 valueUsdc) external onlyOperator {
        require(valueUsdc > 0, "OliveChain: valueUsdc=0");
        bytes32 k = _key(accountId);
        positions[k].collateralValueUsdc += valueUsdc;
        emit CollateralDeposited(accountId, valueUsdc, positions[k].collateralValueUsdc);
    }

    // ---------------------------------------------------------------------
    // Prêt
    // ---------------------------------------------------------------------

    function maxBorrow(string calldata accountId) public view returns (uint256) {
        Position storage p = positions[_key(accountId)];
        uint256 capacity = (p.collateralValueUsdc * LTV_BPS) / BPS_DENOMINATOR;
        if (capacity <= p.loanPrincipal) return 0;
        return capacity - p.loanPrincipal;
    }

    function requestLoan(string calldata accountId, uint256 amount) external onlyOperator {
        require(amount > 0, "OliveChain: amount=0");
        require(amount <= maxBorrow(accountId), "OliveChain: exceeds LTV");

        Position storage p = positions[_key(accountId)];
        if (!p.hasLoan) {
            p.loanStart = block.timestamp;
            p.hasLoan = true;
        }
        p.loanPrincipal += amount;
        emit LoanIssued(accountId, amount, p.loanPrincipal);
    }

    function debtOf(string calldata accountId) public view returns (uint256) {
        Position storage p = positions[_key(accountId)];
        if (!p.hasLoan) return 0;
        uint256 elapsed = block.timestamp - p.loanStart;
        uint256 interest = (p.loanPrincipal * BORROW_APR_BPS * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
        return p.loanPrincipal + interest;
    }

    function repayLoan(string calldata accountId) external onlyOperator returns (uint256 amountRepaid) {
        Position storage p = positions[_key(accountId)];
        require(p.hasLoan, "OliveChain: no active loan");
        amountRepaid = debtOf(accountId);
        p.loanPrincipal = 0;
        p.hasLoan = false;
        p.loanStart = 0;
        emit LoanRepaid(accountId, amountRepaid);
    }

    // ---------------------------------------------------------------------
    // Pool de liquidité (investisseurs)
    // ---------------------------------------------------------------------

    function supplyToPool(string calldata accountId, uint256 amount) external onlyOperator {
        require(amount > 0, "OliveChain: amount=0");
        Position storage p = positions[_key(accountId)];
        if (p.supplied == 0) {
            p.supplyStart = block.timestamp;
        } else {
            // Capitalise les intérêts déjà courus avant d'ajouter le nouveau dépôt
            p.supplied += earnedOf(accountId);
            p.supplyStart = block.timestamp;
        }
        p.supplied += amount;
        poolTotalSupplied += amount;
        emit Supplied(accountId, amount, p.supplied);
    }

    function earnedOf(string calldata accountId) public view returns (uint256) {
        Position storage p = positions[_key(accountId)];
        if (p.supplied == 0) return 0;
        uint256 elapsed = block.timestamp - p.supplyStart;
        return (p.supplied * POOL_APY_BPS * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
    }

    function withdrawFromPool(string calldata accountId) external onlyOperator returns (uint256 total) {
        Position storage p = positions[_key(accountId)];
        require(p.supplied > 0, "OliveChain: nothing supplied");
        total = p.supplied + earnedOf(accountId);
        poolTotalSupplied -= p.supplied;
        p.supplied = 0;
        p.supplyStart = 0;
        emit Withdrawn(accountId, total);
    }

    // ---------------------------------------------------------------------
    // Lecture d'état
    // ---------------------------------------------------------------------

    function getPosition(string calldata accountId)
        external
        view
        returns (
            uint256 collateralValueUsdc,
            uint256 loanPrincipal,
            uint256 currentDebt,
            uint256 maxBorrowable,
            uint256 supplied,
            uint256 earned
        )
    {
        Position storage p = positions[_key(accountId)];
        collateralValueUsdc = p.collateralValueUsdc;
        loanPrincipal = p.loanPrincipal;
        currentDebt = debtOf(accountId);
        maxBorrowable = maxBorrow(accountId);
        supplied = p.supplied;
        earned = earnedOf(accountId);
    }
}
