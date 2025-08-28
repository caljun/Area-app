"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = exports.errorHandler = void 0;
const errorHandler = (error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    let message = error.message || 'サーバーエラーが発生しました';
    if (message.includes('Internal Server Error')) {
        message = 'サーバーエラーが発生しました';
    }
    else if (message.includes('Validation error')) {
        message = '入力内容に問題があります';
    }
    else if (message.includes('Access token required')) {
        message = '認証が必要です';
    }
    else if (message.includes('Invalid token')) {
        message = '認証トークンが無効です';
    }
    else if (message.includes('Token expired')) {
        message = '認証トークンの有効期限が切れています';
    }
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', {
            message: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            body: req.body,
            params: req.params,
            query: req.query
        });
    }
    return res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
};
exports.errorHandler = errorHandler;
const createError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};
exports.createError = createError;
