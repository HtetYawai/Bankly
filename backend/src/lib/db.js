import mongoose from "mongoose";

export const connectDB = async () => {
    try{
        const conn = await mongoose.connect(process.env.MONGODB_URL);
        const topology = await conn.connection.db.admin().command({ hello: 1 });
        if (!topology.setName && topology.msg !== "isdbgrid") {
            throw new Error("MongoDB must be a replica set or sharded cluster to support financial transactions.");
        }
        console.log(`MongoDB connected: ${conn.connection.host}`);
    }catch(error) {
        console.log("MongoDB connection error:", error);
    }
};
