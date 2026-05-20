import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.route.js";
import adminRoutes from "./routes/admin.route.js";
import { connectDB } from "./lib/db.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRoutes from "./routes/user.route.js";
import transactionRoutes from "./routes/transaction.route.js";
import transferRoutes from "./routes/transfer.route.js";
import notificationRoutes from "./routes/notification.route.js";
import User from "./models/user.model.js";

const app = express();

dotenv.config();
const PORT = process.env.PORT;

app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use((req, res, next) => {
  // console.log(`${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/user", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/notifications", notificationRoutes);

const ensureAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) return;

    const adminEmail = process.env.ADMIN_EMAIL || "admin@bankly.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
    const adminPhone = process.env.ADMIN_PHONE || "0000000000";

    await User.create({
      fullName: "Bankly Admin",
      email: adminEmail,
      password: adminPassword,
      phone: adminPhone,
      role: "admin",
    });
    console.log("Admin user created:", adminEmail);
  } catch (error) {
    console.error("Failed to create admin user:", error);
  }
};

const startApp = async () => {
  await connectDB();
  await ensureAdminUser();

  app.listen(PORT, () => {
    console.log("server is running on PORT:" + PORT);
  });
};

startApp();
