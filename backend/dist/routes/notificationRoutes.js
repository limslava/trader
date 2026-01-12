"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NotificationService_1 = require("../services/NotificationService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const notificationService = new NotificationService_1.NotificationService();
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await notificationService.getUserNotifications(userId);
        res.json({
            success: true,
            data: notifications
        });
    }
    catch (error) {
        console.error('Ошибка получения уведомлений:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить уведомления'
        });
    }
});
router.patch('/:id/read', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID уведомления обязателен'
            });
        }
        await notificationService.markAsRead(userId, id);
        return res.json({
            success: true,
            message: 'Уведомление отмечено как прочитанное'
        });
    }
    catch (error) {
        console.error('Ошибка отметки уведомления:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось отметить уведомление как прочитанное'
        });
    }
});
router.delete('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID уведомления обязателен'
            });
        }
        await notificationService.deleteNotification(userId, id);
        return res.json({
            success: true,
            message: 'Уведомление удалено'
        });
    }
    catch (error) {
        console.error('Ошибка удаления уведомления:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось удалить уведомление'
        });
    }
});
router.get('/price-alerts', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const alerts = await notificationService.getUserPriceAlerts(userId);
        res.json({
            success: true,
            data: alerts
        });
    }
    catch (error) {
        console.error('Ошибка получения алертов по ценам:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить алерты по ценам'
        });
    }
});
router.post('/price-alerts', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { assetSymbol, condition, threshold, currentPrice } = req.body;
        if (!assetSymbol || !condition || threshold === undefined || currentPrice === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Необходимы все параметры: assetSymbol, condition, threshold, currentPrice'
            });
        }
        const alert = await notificationService.createPriceAlert(userId, {
            assetSymbol,
            condition,
            threshold,
            currentPrice,
        });
        return res.json({
            success: true,
            data: alert,
            message: 'Алерт по цене создан'
        });
    }
    catch (error) {
        console.error('Ошибка создания алерта по цене:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось создать алерт по цене'
        });
    }
});
router.delete('/price-alerts/:assetSymbol', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { assetSymbol } = req.params;
        if (!assetSymbol) {
            return res.status(400).json({
                success: false,
                message: 'Символ актива обязателен'
            });
        }
        await notificationService.deletePriceAlert(userId, assetSymbol);
        return res.json({
            success: true,
            message: 'Алерт по цене удален'
        });
    }
    catch (error) {
        console.error('Ошибка удаления алерта по цене:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось удалить алерт по цене'
        });
    }
});
router.post('/check', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await notificationService.checkAllNotifications(userId);
        const notifications = await notificationService.getUserNotifications(userId);
        res.json({
            success: true,
            data: notifications,
            message: 'Проверка уведомлений завершена'
        });
    }
    catch (error) {
        console.error('Ошибка проверки уведомлений:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось проверить уведомления'
        });
    }
});
router.post('/cleanup', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        await notificationService.cleanupOldNotifications();
        res.json({
            success: true,
            message: 'Старые уведомления очищены'
        });
    }
    catch (error) {
        console.error('Ошибка очистки уведомлений:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось очистить уведомления'
        });
    }
});
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map