import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import router from './routes/index';
import errorMiddleware from './middleware/error-middleware';
import authMiddleware from './middleware/auth-middleware';



dotenv.config();


const PORT = process.env.PORT || 3000;
const CLIENT_URL ='http://localhost:5173';
const app = express();

console.log('CLIENT_URL:', CLIENT_URL);

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Указываем разрешённые методы
    allowedHeaders: ['Content-Type', 'Authorization'], // Указываем разрешённые заголовки
    
}));
 
app.use('/api', router);
app.use(errorMiddleware);


const dbUrl = process.env.DB_URL;
if (!dbUrl) {
    throw new Error('DB_URL is not defined in .env');
}

const start = async () => {
    try {
        await mongoose.connect(dbUrl);

        app.listen(PORT, () => console.log(`Server startd on PORT =  ${PORT}`));

    } catch (e) {
        console.log(e);
    }
}

start();





// запуск в режиме разработки npm run dev
// сборка и запуск собранного JS npm run build && npm start