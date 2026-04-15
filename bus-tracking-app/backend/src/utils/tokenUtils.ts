import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

/**
 * Generate access token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign({ ...payload }, config.jwt.accessSecret as jwt.Secret, {
        expiresIn: config.jwt.accessExpiry as any,
    });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign({ ...payload }, config.jwt.refreshSecret as jwt.Secret, {
        expiresIn: config.jwt.refreshExpiry as any,
    });
};

/**
 * Verify token
 */
export const verifyToken = (token: string, secret: string): TokenPayload => {
    try {
        return jwt.verify(token, secret) as TokenPayload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
    return verifyToken(token, config.jwt.accessSecret);
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
    return verifyToken(token, config.jwt.refreshSecret);
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): any => {
    return jwt.decode(token);
};

/**
 * Generate token pair (access + refresh)
 */
export const generateTokenPair = (
    payload: TokenPayload
): { accessToken: string; refreshToken: string } => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
    };
};
