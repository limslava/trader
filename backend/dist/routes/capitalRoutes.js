"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const CapitalManagementService_1 = __importDefault(require("../services/CapitalManagementService"));
const router = express_1.default.Router();
const capitalService = new CapitalManagementService_1.default();
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const capital = await capitalService.getUserCapital(userId);
        if (!capital) {
            return res.json({
                success: true,
                data: {
                    initialCapital: 0,
                    currentCapital: 0,
                    availableCapital: 0
                }
            });
        }
        const availableCapital = await capitalService.getAvailableCapital(userId);
        return res.json({
            success: true,
            data: {
                initialCapital: capital.initialCapital,
                currentCapital: capital.currentCapital,
                availableCapital,
                createdAt: capital.createdAt,
                updatedAt: capital.updatedAt
            }
        });
    }
    catch (error) {
        console.error('❌ Ошибка получения капитала:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось получить информацию о капитале'
        });
    }
});
router.post('/initial', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Некорректная сумма капитала'
            });
        }
        const result = await capitalService.setInitialCapital(userId, amount);
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                data: {
                    initialCapital: amount,
                    currentCapital: amount
                }
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
    }
    catch (error) {
        console.error('❌ Ошибка установки стартового капитала:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось установить стартовый капитал'
        });
    }
});
router.post('/deposit', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Некорректная сумма пополнения'
            });
        }
        const result = await capitalService.deposit(userId, amount);
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                data: {
                    newBalance: result.newBalance,
                    depositedAmount: amount
                }
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
    }
    catch (error) {
        console.error('❌ Ошибка пополнения счета:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось пополнить счет'
        });
    }
});
router.post('/withdraw', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Некорректная сумма вывода'
            });
        }
        const result = await capitalService.withdraw(userId, amount);
        if (result.success) {
            return res.json({
                success: true,
                message: result.message,
                data: {
                    newBalance: result.newBalance,
                    withdrawnAmount: amount
                }
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
    }
    catch (error) {
        console.error('❌ Ошибка вывода средств:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось вывести средства'
        });
    }
});
router.get('/available', async (req, res) => {
    try {
        const userId = req.user.userId;
        const availableCapital = await capitalService.getAvailableCapital(userId);
        res.json({
            success: true,
            data: {
                availableCapital
            }
        });
    }
    catch (error) {
        console.error('❌ Ошибка получения доступных средств:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить доступные средства'
        });
    }
});
router.post('/initialize', async (req, res) => {
    try {
        const userId = req.user.userId;
        await capitalService.initializeUserCapital(userId);
        res.json({
            success: true,
            message: 'Капитал пользователя инициализирован'
        });
    }
    catch (error) {
        console.error('❌ Ошибка инициализации капитала:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось инициализировать капитал'
        });
    }
});
exports.default = router;
//# sourceMappingURL=capitalRoutes.js.map