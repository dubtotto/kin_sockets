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
        console.log("send-form", data)

        let response = {
            success: true,
            errors: [],
            data: {
                total: 4687.21,
                items: [
                    { id: 1, name: "Item 1", price: 1000.00, quantity: 1 },
                    { id: 2, name: "Item 2", price: 2000.00, quantity: 1 },
                    { id: 3, name: "Item 3", price: 3000.00, quantity: 1 },
                    { id: 4, name: "Item 4", price: 687.21, quantity: 1 },
                ],
                pdf: "http://localhost:8040/cotizacion.pdf"
            }
        }
        socket.emit("response-form", response)
    })

    socket.on("msg", async (data) => {
        console.log(data)

        socket.emit("response-form", { success: true, errors: [], data: [] })
    })
})

server.listen(8040, function () {
    console.log("Servidor corriendo en http://localhost:8040")
});