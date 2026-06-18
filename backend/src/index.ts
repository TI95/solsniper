import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 3000;

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
};

start();
