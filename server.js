require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const connectDB = require("./src/config/db");
const corsMiddleware = require("./src/config/cors");
const initAPIRoutes = require("./src/router/api");
const initChatSocket = require("./src/sockets/chatSocket");

// Khởi tạo Express & HTTP Server
const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS đồng nhất
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Kết nối Cơ sở dữ liệu MongoDB
connectDB();

// Đăng ký các Mongoose Models để đảm bảo chúng được khởi tạo chính xác
require("./models/user");
require("./models/category");
require("./models/brand");
require("./models/product");
require("./models/cart");
require("./models/order");
require("./models/review");
require("./models/chatbotSession");
require("./models/systemSettings");

console.log("Đã tải thành công toàn bộ Mongoose Models!");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);

// Phục vụ tĩnh thư mục uploads hình ảnh laptop
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Khởi tạo Router API
initAPIRoutes(app);

// Khởi tạo WebSockets Chatbot AI
initChatSocket(io);

// Route cơ bản để kiểm tra server
app.get("/", (req, res) => {
  res.json({ message: "API Laptop Shop & RAG Chatbot is running..." });
});

// Khởi chạy máy chủ (sử dụng server thay vì app để bật Socket.io)
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT} ở chế độ ${process.env.NODE_ENV || "development"}`);
});
