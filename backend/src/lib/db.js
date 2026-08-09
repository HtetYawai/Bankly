import dns from "dns";
import mongoose from "mongoose";

// The mongodb+srv:// scheme needs a DNS SRV lookup before it can connect.
// Some networks ship a broken/unreachable IPv6 DNS resolver that Node's
// dns module queries directly (unlike curl/browsers, which fall back more
// gracefully), so the SRV lookup fails with ECONNREFUSED even though the
// rest of the network is fine. Pointing Node at public resolvers sidesteps
// that without touching system-wide network settings.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

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
