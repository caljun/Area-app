import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  let message = error.message || 'サーバーエラーが発生しました';

  // エラーメッセージの日本語化
  if (message.includes('Internal Server Error')) {
    message = 'サーバーエラーが発生しました';
  } else if (message.includes('Validation error')) {
    message = '入力内容に問題があります';
  } else if (message.includes('Access token required')) {
    message = '認証が必要です';
  } else if (message.includes('Invalid token')) {
    message = '認証トークンが無効です';
  } else if (message.includes('Token expired')) {
    message = '認証トークンの有効期限が切れています';
  }

  // Log error in development
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

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}; 