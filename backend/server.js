const PORT = Number(process.env.PORT) || 5000;
require("dotenv").config();
const { app, connectToDatabase } = require("./app");

async function startServer() {
    try {
        await connectToDatabase();
        console.log("MongoDB connected");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err.message);
        process.exit(1);
    }
}

startServer();
