const express = require("express")
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)
const fetch = require('node-fetch')
const moment = require('moment')


let server_url = `http://localhost:8030/api/`
// let server_url = `http://osxdevel.ddns.net:8000/api/`

io.on("connection", async (socket) => {
    console.log("Nuevo cliente conectado: ", socket.id)

    // Add error handling
    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });
    
    // Add disconnect handling
    socket.on("disconnect", (reason) => {
        console.log("Cliente desconectado:", socket.id, "Razón:", reason);
    });
    
    socket.emit("connection-socket", { socket_id: socket.id, success: true })

    socket.on("send-form", async (data) => {
        console.log(data)

        socket.emit("response-form", { success: true, errors: [], data: [] })
    })
})

server.listen(8040, function () {
    console.log("Servidor corriendo en http://localhost:8040")
});