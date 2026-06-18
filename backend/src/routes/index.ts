import { Router } from 'express';
import UserController from '../controllers/user-controller';
import { body } from 'express-validator'
import authMiddleware from '../middleware/auth-middleware';
import TokensDataController from '../controllers/bought-tokens-controller';
import WalletController from '../controllers/wallet-controller';
import TradeController from '../controllers/trade-controller';
import FilterController from '../controllers/filter-controller';

const router = Router();


router.post('/registration',
    body('email').isEmail(),
    body('password').isLength({ min: 8, max: 32 }),
    UserController.registration
);
router.post('/login', UserController.login);
router.post('/logout', UserController.logout);
router.get('/activate/:link', UserController.activate);
router.get('/refresh', UserController.refresh);
router.post(
    "/tokens",
    authMiddleware,
    [
        body("totalCost").isNumeric().withMessage("Total cost must be a number"),
        body("amount").isNumeric().withMessage("Amount must be a number"),
        body("amountInLamports")
            .isNumeric()
            .withMessage("Amount in lamports must be a number"),
        body("decimals").isInt().withMessage("Decimals must be an integer"),
        body("buyPriceInUSD")
            .isNumeric()
            .withMessage("Buy price in USD must be a number"),
        body("dexId")
            .isIn(["raydium", "pumpswap"])
            .withMessage("Invalid dexId"),
    ],
    TokensDataController.saveTokensData
);


// Роут для получения всех токенов пользователя
router.get("/tokens", authMiddleware, TokensDataController.getTokensData);

router.post('/wallet', authMiddleware, WalletController.save);
router.get('/wallet', authMiddleware, WalletController.get);
router.delete('/wallet', authMiddleware, WalletController.remove);
router.post('/bot/start', authMiddleware, WalletController.startBot);
router.post('/bot/stop', authMiddleware, WalletController.stopBot);

router.get('/filter', authMiddleware, FilterController.get);
router.put('/filter', authMiddleware, FilterController.save);

router.post('/sell/manual', authMiddleware, TradeController.manualSell);
router.get('/positions', authMiddleware, TradeController.positions);
router.get('/trades', authMiddleware, TradeController.trades);

export default router;
