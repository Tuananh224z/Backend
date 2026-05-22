const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const initSystemSettings = require("../src/utils/initSettings");
const { getChatbotReply } = require("../src/services/chatService");

const runTest = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    // Step 1: Run seed/migration to ensure Golden Rules Prompt & llama-3.1-8b-instant are set
    console.log("Running initSystemSettings to seed/update DB...");
    await initSystemSettings();
    console.log("Seeding completed.");

    // Step 2: Test the chatbot reply with a sample session token
    const testSessionToken = "test_session_123456";
    const testMessage = "Tư vấn cho mình một mẫu laptop Asus hoặc Lenovo dưới 20 triệu nhé";

    console.log(`Sending message: "${testMessage}"`);
    console.log("Waiting for chatbot reply...");
    
    const result = await getChatbotReply(testSessionToken, testMessage);
    
    console.log("\n=================== CHATBOT REPLY ===================");
    console.log(result.reply);
    console.log("=====================================================");
    console.log("Suggested Product IDs:", result.suggestedProducts);

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
};

runTest();
