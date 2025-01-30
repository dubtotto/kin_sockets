const express = require("express")
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)
const fetch = require('node-fetch')
const moment = require('moment')
const bodyParser = require('body-parser')


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

        let url = server_url+'service'

        const response_ws = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                'Authentication': data.hash
            }
        })

        socket.emit("notification-newservice", response_ws)
        
        data_ws = await response_ws.json()
        console.log(moment().format() + ' respuesta: ', data_ws)

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

    socket.on("new-notificacion", async (data) => {
        let fields = await formatInput(data)
        switch (fields.type_send*1) {
            case 1:
                setNotificacionAll(socket, fields)
                break;
            case 2:
                setNotificacion(socket, fields)
                break;
            default:
                socket.emit("notificacion-error", { message: 'No se recibio el tipo de notificación.' })
                break;
        }   
    })
    
})

app.use(bodyParser.urlencoded({ extended: true }))

app.post('/api/send-notificacion', async (req, res) => {
    let errors = [], data = {}, response = {}

    console.log(JSON.parse(req.body.data))
    let { sockets, title, message, icon, duration, size, horizontal_position, vertical_position, notification_type, type_noti, dropdown_noti } = JSON.parse(req.body.data)
    
    if(type_noti*1 == 1){
        data.type_noti = type_noti
        data.tipo_notificacion = notification_type
        data.icono = icon
        data.posicion_vertical = vertical_position
        data.posicion_horizontal = horizontal_position
        data.tamanio = size
        data.duracion = duration
        data.title_mensaje = title
        data.text_mensaje = message
        data.dropdown_noti = dropdown_noti
    }else if (type_noti*1 == 2){
        data.type_noti = type_noti
        data.tipo_notificacion = notification_type
        data.duracion = duration,
        data.title_mensaje = title
        data.text_mensaje = message
        data.dropdown_noti = dropdown_noti
    }

    sockets.forEach(async function(socket) {
        let socket_ = await io.in(socket.socket).fetchSockets()
        if (socket_.length) {
            data.dropdown_noti.id_notificacion = socket.id_notificacion
            socket_[0].emit("notificacion", data)
        } else
            console.error(moment().format() + ' - ERR-SOCKETS-001: Error al crear el objeto de socket')
    })

    response = {
        success: errors.length ? false : true,
        errors: errors.length ? errors : false,
        data: errors.length ? false : data
    }
    return res.status(200).send(response)
})

async function setNotificacionAll (socket, fields){
    let response = {}
    if(fields.type_noti*1 == 1){
        response.type_noti = fields.type_noti
        response.tipo_notificacion = fields.tipo_notificacion
        response.icono = fields.icono
        response.posicion_vertical = fields.posicion_vertical
        response.posicion_horizontal = fields.posicion_horizontal
        response.tamanio = fields.tamanio
        response.duracion = fields.duracion
        response.title_mensaje = fields.title_mensaje
        response.text_mensaje = fields.text_mensaje
    }else if (fields.type_noti*1 == 2){
        response.type_noti = fields.type_noti
        response.tipo_notificacion = fields.tipo_notificacion_em
        response.duracion = fields.duracion_em,
        response.title_mensaje = fields.title_mensaje
        response.text_mensaje = fields.text_mensaje
    }
    socket.broadcast.emit("notificacion", response)
    socket.emit("notificacion-ok", { message: 'ok' })
}

async function setNotificacion (socket, fields){
    let response = {}

    let url = `${server_url}notificacion`

    const response_ws = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(fields),
        headers: {
            'Content-Type': 'application/json',
            'Authentication': fields.hash
        }
    })

    data_ws = await response_ws.json()

    if(data_ws.success){

        if(fields.type_noti*1 == 1){
            response.type_noti = fields.type_noti
            response.tipo_notificacion = fields.tipo_notificacion
            response.icono = fields.icono
            response.posicion_vertical = fields.posicion_vertical
            response.posicion_horizontal = fields.posicion_horizontal
            response.tamanio = fields.tamanio
            response.duracion = fields.duracion
            response.title_mensaje = fields.title_mensaje
            response.text_mensaje = fields.text_mensaje
        }else if (fields.type_noti*1 == 2){
            response.type_noti = fields.type_noti
            response.tipo_notificacion = fields.tipo_notificacion_em
            response.duracion = fields.duracion_em,
            response.title_mensaje = fields.title_mensaje
            response.text_mensaje = fields.text_mensaje
        }

        data_ws.data.sockets.forEach(function(socketId) {
            io.to(socketId).emit('notificacion', response)
        })
        socket.emit("notificacion-ok", { message: 'ok' })
    }else
        socket.emit("notificacion-error", { message: data_ws.errors })

}

async function formatInput (obj) {
    var objRes = {}
    for(var i in obj){
        if (obj[i].name in objRes){
            if(Array.isArray(objRes[obj[i].name]))
                objRes[obj[i].name].push(obj[i].value)
            else{
                let value = objRes[obj[i].name]
                objRes[obj[i].name] = []
                objRes[obj[i].name].push(value)
                objRes[obj[i].name].push(obj[i].value)
            }
        }else
            objRes[obj[i].name] = obj[i].value
    }

    return objRes
}

server.listen(8040, function () {
    console.log("Servidor corriendo en http://localhost:8040")
});