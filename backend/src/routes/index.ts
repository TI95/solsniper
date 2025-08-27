import { Router } from 'express';
import UserController from '../controllers/user-controller';
import { body } from 'express-validator'
import authMiddleware from '../middleware/auth-middleware';

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
router.get('/dashboard', authMiddleware, UserController.getUsers); // Protected route

export default router;
