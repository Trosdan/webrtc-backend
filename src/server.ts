import path from 'path';
import express from 'express';
import webSockets from 'ws';

const server = express();
const webSocket = new webSockets.Server({ port: 8080 });

let users: IConnectionSocket[] = [];
let rooms: IRooms[] = [];
let messages: IMessages = {};

interface IMessages {
  [room: string]: { user: string; message: string }[];
}

interface IRooms {
  name: string;
  users: IConnectionSocket[];
}

interface IConnectionSocket {
  name: string;
  socket: webSockets;
}

enum actionTypes {
  CONNECT = 'connect',
  CONNECT_ROOM = 'connectRoom',
  SEND_MESSAGE = 'sendMessage',
}

interface IDataConnect {
  userName: string;
}

interface IDataConnectRoom {
  userName: string;
  roomName: string;
}

interface IDataSendMessage {
  userName: string;
  roomName: string;
  message: string;
}

interface ISocketDataConnect {
  type: actionTypes.CONNECT;
  data: IDataConnect;
}

interface ISocketDataConnectRoom {
  type: actionTypes.CONNECT_ROOM;
  data: IDataConnectRoom;
}

interface ISocketDataSendMessage {
  type: actionTypes.SEND_MESSAGE;
  data: IDataSendMessage;
}

type ISocketData =
  | ISocketDataConnect
  | ISocketDataConnectRoom
  | ISocketDataSendMessage;

webSocket.on('connection', (ws) => {
  ws.on('message', (dataStr: string) => {
    const socketData = JSON.parse(dataStr) as ISocketData;
    switch (socketData.type) {
      case actionTypes.CONNECT: {
        try {
          const { userName } = socketData.data;

          const userExist = users.find((user) => user.name === userName);

          if (userExist) throw new Error();

          users.push({ name: userName, socket: ws });
          ws.send(JSON.stringify({ type: 'connected' }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'connectedFail' }));
        }
        break;
      }
      case actionTypes.CONNECT_ROOM: {
        const { userName, roomName } = socketData.data;

        const roomIndex = rooms.findIndex((room) => room.name === roomName);
        if (roomIndex === -1) {
          rooms.push({
            name: roomName,
            users: [{ name: userName, socket: ws }],
          });
          messages = { ...messages, [roomName]: [] };
        } else {
          rooms[roomIndex].users.push({ name: userName, socket: ws });
          messages[roomName].forEach((message) => {
            ws.send(
              JSON.stringify({
                type: 'message',
                name: message.user,
                message: message.message,
                room: roomName,
              })
            );
          });
        }
        break;
      }
      case actionTypes.SEND_MESSAGE: {
        const { userName, roomName, message } = socketData.data;
        console.log({ userName, roomName, message });

        const roomIndex = rooms.findIndex((room) => room.name === roomName);
        if (roomIndex !== -1) {
          messages[roomName] = [
            ...messages[roomName],
            {
              user: userName,
              message: message,
            },
          ];

          rooms[roomIndex].users.forEach((user) =>
            user.socket.send(
              JSON.stringify({
                type: 'message',
                name: userName,
                message: message,
                room: roomName,
              })
            )
          );
        }
        break;
      }
    }
  });
});

server.get('/', (req, res) => {
  return res.status(200).json({ status: 'Running', users, rooms, messages });
});

server.use('/app', express.static(path.resolve(__dirname, '..', 'public')));

server.listen(3004, () => console.log('Server is Running'));
