var fs = require('fs');//node自带工具模块
var path = require('path');//node路径工具
var express = require('express');//后台框架
// var bodyParser = require('body-parser')
// var webpack = require('webpack');//打包工具
// var config = require('./webpack.config'); //打包配置
var app = express();//创建一个express实例
var server = require('http').createServer(app);//创建一个HTTP服务器，将express作为res事件的监听函数
var io = require('socket.io')(server); //这是socket.io和express的使用
var exec = require('child_process').exec, child;//系统命令
// var compiler = webpack(config);

// var jsonParser = bodyParser.json();


app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1');
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});//用于跨域，但是socket好像本身就可以跨域

app.use(express.static(path.join(__dirname, '/')));

// app.use(bodyParser.json())


//此express 路由配置的是/路由下的响应，就是范围默认地址后响应一个网页文件


// socket监听的事件 
var room = 0;
var isUp = 0;
var roomArray = [];
var index = 0;
io.on('connection', function (socket) {
    socket.on('room', function (data) {
        //加入房间
        console.log("new connected:" + JSON.stringify(data)+"room=="+room);
        socket.join(room); 
        var userData = [];
        userData.push(data)
        if (roomArray.length > 0) {
            if (roomArray[roomArray.length - 1].length >= 2) {
                roomArray.push(userData);
            } else {
                roomArray[roomArray.length - 1].push(data)
            }
        } else {
            roomArray.push(userData)
        }
        socket.emit('joinRoom', {
            room: room,
            index: index
        })
        socket.emit('people', {
            roomArray: roomArray[room],
            room: room,
        })

        if (index==0){
            index=1
        }else{
            index = 0
        }
        if (isUp==1){
            isUp=0
            room++
        }else{
            isUp += 1
        };
    });

    socket.on('matchTo',function(data){
        var matchRoom = data.room;
        roomArray[matchRoom][data.index].isOk = data.isOk;
        socket.emit('people', {
            roomArray: roomArray[matchRoom],
            room: matchRoom
        })
        socket.to(data.room).broadcast.emit('people', {
            roomArray: roomArray[matchRoom],
            room: matchRoom
        })
    })
    
});

server.listen(8080, '0.0.0.0', function (err) {
    if (err) {
        return console.log(err);
    }
    console.log('Listening at http://0.0.0.0:8080');
});
