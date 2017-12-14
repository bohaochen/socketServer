var fs = require('fs');
var UserManager = require('./Manager.js');


function mkdir(dirArray, _callback) {
    //todo 绝对路径的问题
    fs.exists(dirArray, function (exists) {
        if (!exists) {
            fs.mkdir(dirArray, function (err) {
                if (err) {
                    console.log(err);
                    console.log(dirArray + '创建文件夹出错！');
                } else {
                    console.log(dirArray + '文件夹-创建成功！');
                    _callback();
                }
            });
        } else {
            _callback();
            return false;
        }
    });
}//创建文件夹



function RoomManager() {
    this.roomArray = new Array();
}

RoomManager.prototype.findOrBuildRoom = function (room) {
    //var liveRoom;
    for (i = 0, len = this.roomArray.length; i < len; i++) {
        var tmpRoom = this.roomArray[i];
        if (room == tmpRoom.room) {
            return tmpRoom;
        }
    }
    var liveRoom = new LiveRoom(room, this);
    this.roomArray.push(liveRoom);
    return liveRoom;
}

RoomManager.prototype.Remove = function (liveRoom) {

}

var roomManager = new RoomManager();


function Operation() {
    var result = {
        path: [],
        beginDrawingTime: 0,
        page: null,
        lastPage: null,
        lastStartTime: 0,
        pageNum: 1
    }
    return result;
}

function RecordObj() {
    var result = {
        startRecordTime: 0,
        endRecordTime: 0,
        recordArray: [],
        recordState: 0
    }
    return result;
}

function writeDataTofile(roomId, fileName, w_data,liveRoom) {
    var path = __dirname + "/../output_json/" + roomId;
    mkdir(path, function () {
        fs.writeFile(path + "/" + fileName + '.json', w_data, { flag: 'w' }, function (err) {
            if (err) {
                console.error(err);
            } else {
                console.log('写入成功');
            }
        });
    });
}

function configSocket(socket, liveRoom) {
    var room = liveRoom.room;

    socket.on('recordOver', function (recordNum, roomId) {
        //记录
        console.log("结束录制事件")
        liveRoom.operation.lastPage = liveRoom.operation.page;
        liveRoom.recordNow(socket);
        var w_data;
        var timeNow = new Date().getTime();//现在时间
        var roomStateData = {
            "data": {
                "room": roomId,
                "state": 2
            }
        }
        liveRoom.Broadcast(socket, 'roomState', roomStateData);
        liveRoom.recordObj.recordState = 2;
        liveRoom.recordObj.endRecordTime = new Date().getTime();
        liveRoom.storeConfig();
        //end
    });//本地储存操作

    socket.on('BeginRtmpNow', function (data) {
        //开始录制
        var startRecordTime = new Date().getTime();//现在时间
        liveRoom.recordObj.startRecordTime = startRecordTime;
        liveRoom.operation.beginDrawingTime = startRecordTime;
        liveRoom.recordObj.recordState = 1;
        liveRoom.Broadcast(socket, 'roomState', data);
        console.log("From BeginRtmpNow changePage for room:" + liveRoom.room + "  data:" + JSON.stringify(data) + " startRecordTime:" + startRecordTime);
    });

    socket.on('changePage', function (data) {
        //转播切换图片
        console.log("changePage for room:" + liveRoom.room + "  data:" + JSON.stringify(data) + " startRecordTime:" + startRecordTime);
        liveRoom.operation.lastPage = liveRoom.operation.page;
        liveRoom.operation.page = data;
        liveRoom.notifyPageChanged(socket);
        liveRoom.recordNow(socket);
    });

    socket.on('drawPath', function (data) {
        //转播轨迹
        var time = new Date().getTime();
        var operationPath = liveRoom.operation.path;
        if (operationPath && liveRoom.recordObj.recordState==1) {
            data[9] = time - liveRoom.recordObj.startRecordTime;
            operationPath.push(data);
            liveRoom.Broadcast(socket, 'showPath', data);
        }
    });//接受直播操作

    socket.on('disconnect', function () {
        liveRoom.userDisconnect(socket);
    })

    socket.on('message', function (message) {
        // 监听客户端的socket.send(message)方法
        if (message == 'clear') {
            liveRoom.Broadcast(socket, 'showBoardClearArea');
        } else if (message == 'drawEnd') {
            liveRoom.Broadcast(socket, 'drawEnd');
        } else if (message == 'quit') {
            liveRoom.quitRoom(socket);
        }
    });
}


function LiveRoom(room, roomManager) {
    this.room = room;
    this.pageNum = 1;
    this.userManager = new UserManager();
    this.roomManager = roomManager;
    this.operation = Operation();
    this.recordObj = RecordObj();
}

LiveRoom.prototype.reSizeRecordObj = function (user) {
    //重置录制对象
    this.operation = Operation();
    this.recordObj = RecordObj();
}

LiveRoom.prototype.AddNewUser = function (user) {
    console.log("new user:" + user.uid +"-userRole:"+ user.role + "  join:" + this.room);
    user.socket.join(this.room);
    configSocket(user.socket, this);
    var oldUser = this.userManager.AddOnlyOne(user);
    this.notifyUserQuit(oldUser);
    this.notifyUserCountChanged(user);
    user.socket.emit('beginRtmp', this.operation);
    var data = { userCount: this.userManager.UserCount(), userId: "fromJoinRoom" };//每当用户登录，广播此房间用户，用于统计人数，以及重复登录
    this.SendAllClient('peopleChange', data);
}

LiveRoom.prototype.RemoveUser = function (user) {

}


LiveRoom.prototype.SendAllClient = function (action, data) {
    //socket.to(this.room).broadcast.emit(action, data);
    var user = this.userManager.GetFirstUser();
    if (user) {
        user.socket.to(this.room).broadcast.emit(action, data);
        user.socket.emit(action, data);
    }
}

LiveRoom.prototype.Broadcast = function (socket, action, data) {
    socket.to(this.room).broadcast.emit(action, data);
}


LiveRoom.prototype.userDisconnect = function (socket) {
    //  console.log(socket);
    var user = this.userManager.RemoveBySocketId(socket.id);
    socket.leave(this.room);
    console.log(user.uid + ':removed');
    this.notifyUserCountChanged(user);
}

LiveRoom.prototype.quitRoom = function (socket) {
    this.userDisconnect(socket);
}


LiveRoom.prototype.notifyUserQuit = function (users) {

    if (users && users.length > 0) {
        for (i = 0, len = users.length; i < len; i++) {
            var user = users[i];
            console.log("notifyUserQuit:" + user.socket.id + "  uid:" + user.uid);
            user.socket.send("NewUserLogin");
        }
    }
}

LiveRoom.prototype.notifyPageChanged = function (socket) {
    var user = this.userManager.GetUserBySocketId(socket.id);
    user.socket.to(user.room).broadcast.emit('changePage', this.operation.page);
}

LiveRoom.prototype.recordNow = function (socket){
    if (!this.operation.lastPage) {
        return;
    }
    var timeNow = new Date().getTime();//现在时间
    var userhand = this.operation.path;
    var userimgSrc = this.operation.lastPage.url;
    var nowDrawing = {
        userhand: userhand,
        imgSrc:userimgSrc,
        startTime: this.operation.lastStartTime,
        endTime: timeNow - this.recordObj.startRecordTime
    };//储存动作和背景图
    var nowDrawingJsonStr = JSON.stringify(nowDrawing)
    this.updateConfig({ fileName: ""+this.pageNum, startTime: this.operation.lastStartTime});
    var w_data = new Buffer(nowDrawingJsonStr);
    writeDataTofile(this.room, this.pageNum, w_data)
    this.pageNum++;
    this.operation.path = [];
    this.operation.lastStartTime = timeNow - this.recordObj.startRecordTime;
}

LiveRoom.prototype.updateConfig = function(item){
    this.recordObj.recordArray.push(item);
}

LiveRoom.prototype.storeConfig = function (item) {
    var recordStr = JSON.stringify(this.recordObj);
    var w_data = new Buffer(recordStr);
    writeDataTofile(this.room,"config", w_data);
    this.reSizeRecordObj();
}

LiveRoom.prototype.notifyUserCountChanged = function (user) {

    if (user) {
        var room = user.room;
        try {
            var data = { userCount: this.userManager.UserCount(), userId: user.uid };
            console.log(data)
            user.socket.to(room).broadcast.emit('peopleChange', data);//每当用户登录，广播此房间用户，用于统计人数，以及重复登录
            console.log("notifyUserCountChanged")
        } catch (error) {
            console.log("异常111")
        }
    }
}






module.exports = roomManager;
