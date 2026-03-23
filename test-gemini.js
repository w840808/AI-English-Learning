const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyDNSCY5-Kol7Z-Q87K4elysxiL1eStNoCM");

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello?");
    console.log("SUCCESS:", result.response.text());
  } catch(e) {
    console.error("ERROR 1.5-flash:", e.message);
  }
}
run();
