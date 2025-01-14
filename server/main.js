const express = require("express")
const app = express()
const server = require("http").Server(app)
const io = require("socket.io")(server)
const bodyParser = require('body-parser')
let CryptoJS = require("crypto-js")
const xml2js = require('xml2js')
const fetch = require('node-fetch')
const moment = require('moment')
const { Pool } = require('pg')
const { error } = require("console")

const config = {
    host: 'osxdevel.ddns.net',
    user: 'marquest3',
    password: 'y3Kh]49w&?kMT"zYT3',
    database: 'marquest3'
}

const pool = new Pool(config)

let server_url = `http://localhost:8030/api/`
// let server_url = `http://osxdevel.ddns.net:8000/api/`

io.on("connection", async (socket) => {
    socket.emit("connection-socket", { socket_id: socket.id, success: true })

    socket.on("send-form", async (data) => {
        console.log(data)

        socket.emit("response-form", { success: true, errors: [], data: [] })
    })
})

const router = express.Router()
app.use(bodyParser.urlencoded({ extended: true }))
app.post('/api/response-santander', async (req, res) => {
    let errors = [], data = [], response = {}
    try {

        let { strResponse } = req.body

        //prueba
        //let key = '5DCC67393750523CD165F17E1EFADD21'

        //preprod
        let key = 'A2832DE3C0B2289253D4B383404E8C1C'
        
        let ciphertext = decifrarAES(strResponse, key).toString()
        let parser = new xml2js.Parser({ mergeAttrs: true })
        parser.parseString(ciphertext, async (err, result) => {

            try {
                let datos = JSON.stringify(result, null, 4)
                datos = JSON.parse(datos)
                datos.motorid = 2

                let res_bit = await saveResponse('santander', datos)

                if (res_bit) {
                    let res_apply = await applyPaySantander(datos, 1, res_bit)
                    data = res_apply.data
                } else
                    console.error(moment().format() + ' - ERR-SOCKETS-003: Error al registrar en bitacora')

                response = {
                    success: errors.length ? false : true,
                    errors: errors.length ? errors : false,
                    data: errors.length ? false : data
                }

                return res.status(200).send(response)

            } catch (e) {
                errors.push('ERR-SOC-004: Se produjo un error de ejecución')
                console.error(moment().format() + ' - ERR-SOC-004: ' + e)
                return res.status(500).send(e.message)
            }
        })

    } catch (e) {
        errors.push('ERR-SOC-005: Se produjo un error de ejecución')
        console.error(moment().format() + ' - ERR-SOC-005: ' + e)
        return res.status(500).send(e.message)
    }

    function _arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer)
        var len = bytes.byteLength
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return Buffer.from(binary).toString('base64')
        //return window.btoa(binary);
    }

    function base64toHEX(base64) {
        var raw = atob(base64)
        var HEX = ''
        for (let i = 0; i < raw.length; i++) {
            var _hex = raw.charCodeAt(i).toString(16)
            HEX += (_hex.length == 2 ? _hex : '0' + _hex)
        }
        return HEX.toUpperCase()
    }


    function decifrarAES(cadena_cifrada, key) {
        var key = CryptoJS.enc.Hex.parse(key);
        var first = CryptoJS.enc.Base64.parse(cadena_cifrada) //cadena_cifrada.clone();
        var second = CryptoJS.enc.Base64.parse(cadena_cifrada) //cadena_cifrada;
        first.words = first.words.slice(0, 4)
        second.words = second.words.slice(4, second.length)
        first.sigBytes = 16
        second.sigBytes = second.sigBytes - 16
        second = CryptoJS.enc.Base64.stringify(second)
        var cipherParams = {
            iv: first,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
        var decrypted = CryptoJS.AES.decrypt(second, key, cipherParams)
        decrypted = decrypted.toString(CryptoJS.enc.Utf8)
        return decrypted
    }

})

app.post('/api/response_bbva', async (req, res) => {


    let errors = [], data = [], response = {}
    req.body.motorid = 3

    let res_bit = await saveResponse('bbva', req.body)

    if (res_bit) {
        let res_apply = await applyPayBbva(req.body, 1, res_bit)
        data = res_apply.data
    } else
        console.error(moment().format() + ' - ERR-SOCKETS-002: Error al registrar en bitacora')

    response = {
        success: errors.length ? false : true,
        errors: errors.length ? errors : false,
        data: errors.length ? false : data
    }

    return res.status(200).send(response)

})

async function applyPaySantander(obj, attempts, id_bitacora) {
    let errors = [], data = [], response = {}
    try {

        if (attempts <= 5) {

            console.log(moment().format() + ` - Aplicando bitacora id: ${id_bitacora}, intento no. ${attempts} `)

            let hash = obj.CENTEROFPAYMENTS.obj_adicionales[0].data.find(x => x.label[0] === 'hash').value[0],
                socket_id = Buffer.from(obj.CENTEROFPAYMENTS.obj_adicionales[0].data.find(x => x.label[0] === 'socket').value[0], 'base64').toString('ascii')

            let url = `${server_url}payShoppingCart`

            const response_ws = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(obj),
                headers: {
                    'Content-Type': 'application/json',
                    'Authentication': hash
                }
            })

            data_ws = await response_ws.json()
            console.log(moment().format() + ' respuesta: ', data_ws)

            if (data_ws.success) {
                await pool.query("set time zone 'America/Mexico_City'")
                let snt = ` UPDATE INTO bitacora_respuesta_pago SET aplicado = 1, fechaaplicacion = now(), json_liquidaciones = $1,
                        id_carrito = $2 
                        WHERE id_bitacora = $3 `
                await pool.query(snt, [JSON.stringify(data_ws.data_socket), data_ws.data, id_bitacora])

                const socket = await io.in(socket_id).fetchSockets()
                if (socket.length) {
                    socket[0].emit("response-bbva", data_ws)
                } else
                    console.error(moment().format() + ' - ERR-SOCKETS-001: Error al crear el objeto de socket')
            } else {
                attempts++
                return await applyPayBbva(obj, attempts)
            }

        }


    } catch (e) {
        errors.push('ERR-SOC-003: Se produjo un error de ejecución')
        console.error(moment().format() + ' - ERR-SOC-003: ' + e)
        attempts++
        return await applyPayBbva(obj, attempts)
    }

    response = {
        success: errors.length ? false : true,
        errors: errors.length ? errors : false,
        data: errors.length ? false : data
    }

    return response
}

async function applyPayBbva(obj, attempts, id_bitacora) {
    let errors = [], data = [], response = {}
    try {

        if (attempts <= 5){

            console.log(moment().format() + ` - Aplicando bitacora id: ${id_bitacora}, intento no. ${attempts} ` )
            
            let { sk_osx: socket_id, hash_osx: hash } = obj

            let url = `${server_url}payShoppingCart`
            const response_ws = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(obj),
                headers: {
                    'Content-Type': 'application/json',
                    'Authentication': hash
                }
            })

            data_ws = await response_ws.json()
            console.log(moment().format() + ' respuesta: ', data_ws)

            if (data_ws.success) {
                await pool.query("set time zone 'America/Mexico_City'")
                let snt = ` UPDATE INTO bitacora_respuesta_pago SET aplicado = 1, fechaaplicacion = now(), json_liquidaciones = $1,
                        id_carrito = $2 
                        WHERE id_bitacora = $3 `
                await pool.query(snt, [JSON.stringify(data_ws.data_socket), data_ws.data, id_bitacora])
                
                const socket = await io.in(socket_id).fetchSockets()
                if (socket.length) {
                    socket[0].emit("response-bbva", data_ws)
                } else
                    console.error(moment().format() + ' - ERR-SOCKETS-001: Error al crear el objeto de socket')
            } else{
                attempts++
                return await applyPayBbva(obj, attempts)
            }
                    
        }
        

    } catch (e) {
        errors.push('ERR-SOC-003: Se produjo un error de ejecución')
        console.error(moment().format() + ' - ERR-SOC-003: ' + e)
        attempts++
        return await applyPayBbva(obj, attempts)
    }

    response = {
        success: errors.length ? false : true,
        errors: errors.length ? errors : false,
        data: errors.length ? false : data
    }

    return response
}

async function saveResponse(banco, respuesta){
    await pool.query("set time zone 'America/Mexico_City'")
    let snt = ` INSERT INTO bitacora_respuesta_pago (banco, respuesta) VALUES ($1, $2) RETURNING id_bitacora`
    const qry = await pool.query(snt, [banco, respuesta])
    if (qry.rowCount)
        return qry.rows[0].id_bitacora

    return false
    
}

server.listen(8040, function () {
    console.log("Servidor corriendo en http://localhost:8040")
});