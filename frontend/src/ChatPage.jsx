import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Container, Row, Col, ListGroup, Form, Button, Card, InputGroup, Spinner, Badge, Table } from 'react-bootstrap';
import { BsChatDots, BsTrash } from 'react-icons/bs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const ChatPage = () => {
    // State management
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [otherParticipantId, setOtherParticipantId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [typing, setTyping] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef(null);

    // Effect for initial setup: authentication and socket connection
    useEffect(() => {
        const storedUser = {
            token: localStorage.getItem('token'),
            id: localStorage.getItem('userId'),
            role: localStorage.getItem('role')
        };
        let newSocket;
        if (storedUser.token && storedUser.id && storedUser.role) {
            setUser(storedUser);
            newSocket = io(BACKEND_URL, { auth: { token: storedUser.token } });
            setSocket(newSocket);
        }
        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, []);

    // Effect for fetching initial chat data
    useEffect(() => {
        if (!user || !socket) return;

        const fetchAdminData = async () => {
            try {
                const { data } = await axios.get(`${BACKEND_URL}/api/chats`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setChats(data);
            } catch (error) {
                console.error("Failed to fetch chats", error);
            }
        };

        const fetchUserData = async () => {
            try {
                const { data } = await axios.post(`${BACKEND_URL}/api/chats`, {}, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setActiveChat(data);
                socket.emit('joinChat', data._id);
            } catch (error) {
                console.error("Failed to start chat", error);
            }
        };

        if (user.role === 'admin') {
            fetchAdminData();
        } else {
            fetchUserData();
        }
    }, [user, socket]);

    // Effect to set messages when activeChat changes
    useEffect(() => {
        if (activeChat) {
            setMessages(activeChat.messages);
            if (user?.role === 'admin') {
                const otherUser = activeChat.participants.find(p => p.role === 'user');
                setOtherParticipantId(otherUser?._id);
            }
        }
    }, [activeChat, user?.role]);

    // Effect for handling real-time socket events
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (message) => {
            if (user?.role === 'admin') {
                setChats(prevChats =>
                    prevChats.map(chat =>
                        chat._id === message.chatId
                            ? { ...chat, messages: [...chat.messages, message] }
                            : chat
                    )
                );
            }
            if (activeChat && message.chatId === activeChat._id) {
                setMessages(prevMessages => [...prevMessages, message]);
                // Increment unread count if chat is not open
                if (!isOpen) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        };

        const handleUpdateChatList = () => {
            if (user?.role === 'admin') {
                axios.get(`${BACKEND_URL}/api/chats`, { headers: { Authorization: `Bearer ${user.token}` } })
                    .then(({ data }) => setChats(data));
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('updateChatList', handleUpdateChatList);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('updateChatList', handleUpdateChatList);
        };
    }, [socket, activeChat, user, isOpen]);

    // Effect to scroll to the bottom of the messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const selectChatForAdmin = (chat) => {
        setActiveChat(chat);
        socket.emit('joinChat', chat._id);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && activeChat && user) {
            const messageData = {
                chatId: activeChat._id,
                senderId: user.id,
                content: newMessage.trim(),
            };
            socket.emit('sendMessage', messageData);
            setNewMessage('');
        }
    };

    const handleDeleteChat = async (chatId) => {
        if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await axios.delete(`${BACKEND_URL}/api/chats/${chatId}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            // Remove the chat from the local state
            setChats(prevChats => prevChats.filter(chat => chat._id !== chatId));
            
            // If the deleted chat was active, clear the active chat
            if (activeChat && activeChat._id === chatId) {
                setActiveChat(null);
                setMessages([]);
                setOtherParticipantId(null);
            }

            // Emit socket event to notify other clients
            socket.emit('deleteChat', chatId);
            
            console.log('Chat deleted successfully');
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat. Please try again.');
        }
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setUnreadCount(0);
        }
    };

    if (!user) {
    return null; // Don't render anything if not logged in
  }

  // For admin role, render a full-page chat interface instead of floating widget
  if (user.role === 'admin') {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="mb-1">Customer Support Chat</h2>
            <p className="text-muted mb-0">Manage and respond to customer conversations</p>
          </div>
          <div className="d-flex gap-2">
            <Badge bg="primary" className="fs-6">
              {chats.length} Active Conversations
            </Badge>
           
          </div>
        </div>

        <Row className="g-4">
          <Col lg={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white border-bottom-0 py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    <BsChatDots className="me-2 text-primary" />
                    Conversations ({chats.length})
                  </h5>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Table className="mb-0">
                    <tbody>
                      {chats.map(chat => {
                        const otherUser = chat.participants.find(p => p.role === 'user');
                        const lastMsg = chat.messages[chat.messages.length - 1];
                        const messageCount = chat.messages.length;
                        const isActive = activeChat?._id === chat._id;
                        
                        return (
                          <tr 
                            key={chat._id} 
                            className={`border-bottom ${isActive ? 'table-primary' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => selectChatForAdmin(chat)}
                          >
                            <td className="py-3">
                              <div className="d-flex justify-content-between align-items-start">
                                <div className="flex-grow-1">
                                  <div className="fw-medium mb-1">{otherUser?.name || 'Deleted User'}</div>
                                  <small className="text-muted d-block" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {lastMsg?.content || 'No messages yet'}
                                  </small>
                                  <small className="text-muted">
                                    {lastMsg?.timestamp ? new Date(lastMsg.timestamp).toLocaleDateString() : 'No activity'}
                                  </small>
                                </div>
                                <div className="d-flex flex-column align-items-end gap-1">
                                 
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteChat(chat._id);
                                    }}
                                    title="Delete conversation"
                                  >
                                    <BsTrash size={10} />
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {chats.length === 0 && (
                        <tr>
                          <td className="text-center py-4 text-muted">
                            <BsChatDots size={32} className="mb-2" />
                            <div>No conversations yet</div>
                            <small>Customer conversations will appear here</small>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col lg={8}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white border-bottom-0 py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">
                    {activeChat ? (
                      <>
                        <BsChatDots className="me-2 text-primary" />
                        Chat with {activeChat.participants.find(p => p.role === 'user')?.name || 'Customer'}
                      </>
                    ) : (
                      <>
                        <BsChatDots className="me-2 text-muted" />
                        Select a conversation
                      </>
                    )}
                  </h5>
                 
                </div>
              </Card.Header>
              <Card.Body className="p-0 d-flex flex-column" style={{ height: '600px' }}>
                {activeChat ? (
                  <>
                    <div className="flex-grow-1 p-3" style={{ overflowY: 'auto', maxHeight: '500px' }}>
                      {messages.map((msg, index) => {
                        const isSentByMe = String(msg.sender?._id) === String(user.id);
                        const messageType = isSentByMe ? 'sent' : 'received';

                        return (
                          <div key={msg._id} className={`d-flex mb-3 ${messageType === 'sent' ? 'justify-content-end' : 'justify-content-start'}`}>
                            <div 
                              className={`p-3 rounded-3 ${messageType === 'sent' ? 'bg-primary text-white' : 'bg-light'}`}
                              style={{ maxWidth: '70%' }}
                            >
                              <div className="mb-1">{msg.content}</div>
                              <small className={`d-block ${messageType === 'sent' ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '11px' }}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                      {typing && (
                        <div className="d-flex justify-content-start mb-3">
                          <div className="p-3 rounded-3 bg-light">
                            <div className="text-muted">Typing...</div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    
                    <div className="p-3 border-top">
                      <Form onSubmit={handleSendMessage}>
                        <InputGroup>
                          <Form.Control
                            type="text"
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            autoComplete="off"
                          />
                          <Button variant="primary" type="submit" disabled={!newMessage.trim()}>
                            Send
                          </Button>
                        </InputGroup>
                      </Form>
                    </div>
                  </>
                ) : (
                  <div className="d-flex justify-content-center align-items-center flex-grow-1">
                    <div className="text-center text-muted">
                      <BsChatDots size={48} className="mb-3" />
                      <h5>Select a conversation to begin</h5>
                      <p>Choose a customer from the left panel to start chatting</p>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

    const receivedSenderId = user.role === 'admin' ? otherParticipantId : activeChat?.participants.find(p => p.role === 'admin')?._id;

    return (
        <>
            <style type="text/css">{`
                .chat-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 1000;
                    transition: all 0.3s ease;
                }
                
                .chat-button {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: #0d6efd;
                    color: white;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .chat-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                }
                
                .chat-button .unread-badge {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #dc3545;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .chat-container {
                    position: fixed;
                    bottom: 90px;
                    right: 20px;
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    transform: ${isOpen ? 'translateY(0)' : 'translateY(100%)'};
                    opacity: ${isOpen ? '1' : '0'};
                    transition: all 0.3s ease;
                }
                
                .chat-header {
                    background: #0d6efd;
                    color: white;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .chat-header h6 {
                    margin: 0;
                    font-weight: 600;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .chat-body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                .chat-list {
                    height: 100%;
                    overflow-y: auto;
                    border: none;
                }
                
                .chat-list-item {
                    border: none;
                    border-bottom: 1px solid #f0f0f0;
                    padding: 12px 15px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .chat-list-item:hover {
                    background-color: #f8f9fa;
                }
                
                .chat-list-item.active {
                    background-color: #e3f2fd !important;
                    border-left: 3px solid #0d6efd;
                }
                
                .message-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                .message-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    background: #f8f9fa;
                }
                
                .message-row {
                    display: flex;
                    margin-bottom: 10px;
                }
                
                .message {
                    padding: 8px 12px;
                    border-radius: 18px;
                    max-width: 80%;
                    word-wrap: break-word;
                    font-size: 14px;
                }
                
                .message-sent {
                    background-color: #0d6efd;
                    color: white;
                    margin-left: auto;
                }
                
                .message-received {
                    background-color: white;
                    color: #333;
                    border: 1px solid #e0e0e0;
                }
                
                .message-input {
                    padding: 15px;
                    border-top: 1px solid #e0e0e0;
                    background: white;
                }
                
                .message-input .form-control {
                    border-radius: 20px;
                    border: 1px solid #e0e0e0;
                }
                
                .message-input .btn {
                    border-radius: 20px;
                    margin-left: 8px;
                }
                
                .chat-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #6c757d;
                    font-style: italic;
                }
            `}</style>
            
            <div className="chat-widget">
                {/* Chat Button */}
                <button className="chat-button" onClick={toggleChat}>
                    💬
                    {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                </button>
                
                {/* Chat Container */}
                <div className="chat-container">
                    <div className="chat-header">
                        <h6>
                            {user.role === 'admin' 
                                ? (activeChat ? `Chat with ${activeChat.participants.find(p => p.role === 'user')?.name || 'User'}` : 'Conversations')
                                : 'Chat with Admin'
                            }
                        </h6>
                        <button className="close-btn" onClick={toggleChat}>×</button>
                    </div>
                    
                    <div className="chat-body">
                        {user.role === 'admin' && !activeChat ? (
                            // Admin chat list view
                            <ListGroup className="chat-list">
                                    {chats.map(chat => {
                                        const otherUser = chat.participants.find(p => p.role === 'user');
                                        const lastMsg = chat.messages[chat.messages.length - 1];
                                        return (
                                            <ListGroup.Item
                                                key={chat._id}
                                                action
                                                onClick={() => selectChatForAdmin(chat)}
                                            className="chat-list-item"
                                            >
                                                <div className="fw-bold">{otherUser?.name || 'Deleted User'}</div>
                                            <small className="text-muted">
                                                {lastMsg?.content.substring(0, 25) || 'No messages yet'}
                                                {lastMsg?.content.length > 25 ? '...' : ''}
                                            </small>
                                            </ListGroup.Item>
                                        );
                                    })}
                                </ListGroup>
                        ) : activeChat ? (
                            // Message view
                            <div className="message-area">
                                <div className="message-list">
                                    {messages.map((msg, index) => {
                                        const isSentByMe = String(msg.sender?._id) === String(user.id);
                                        const messageType = isSentByMe ? 'sent' : 'received';

                                        return (
                                            <div key={msg._id} className={`message-row justify-content-${messageType === 'sent' ? 'end' : 'start'}`}>
                                                <div className={`message message-${messageType}`}>
                                                    <div>{msg.content}</div>
                                                    <small className="text-muted d-block mt-1" style={{ 
                                                        color: messageType === 'sent' ? '#f0f0f0' : '#6c757d',
                                                        fontSize: '11px'
                                                    }}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </small>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {typing && <div className="text-muted">...</div>}
                                    <div ref={messagesEndRef} />
                                </div>
                                
                                <div className="message-input">
                                    <Form onSubmit={handleSendMessage}>
                                        <InputGroup>
                                            <Form.Control
                                                type="text"
                                                placeholder="Type a message..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                autoComplete="off"
                                            />
                                            <Button variant="primary" type="submit" size="sm">Send</Button>
                                        </InputGroup>
                                    </Form>
                                </div>
                            </div>
                        ) : (
                            // Loading state
                            <div className="chat-placeholder">
                                <Spinner animation="border" size="sm" /> Loading chat...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ChatPage;