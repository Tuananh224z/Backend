const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const testGroq = async () => {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  const apiUrl = (process.env.GROQ_URL || "https://api.groq.com/openai/v1").trim();

  try {
    const response = await axios.get(
      `${apiUrl}/models`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    console.log("MODELS:", response.data.data.map(m => m.id));
  } catch (error) {
    console.error("FAILED. Status:", error.response?.status);
    console.error("Error data:", JSON.stringify(error.response?.data, null, 2));
  }
};

testGroq();
