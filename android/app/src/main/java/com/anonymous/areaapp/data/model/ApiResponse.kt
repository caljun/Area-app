package com.anonymous.areaapp.data.model

import kotlinx.serialization.Serializable

// Authentication responses
@Serializable
data class AuthResponse(
    val token: String,
    val user: User,
    val isNewUser: Boolean? = null,
    val profileComplete: Boolean? = null,
    val missingFields: List<String>? = null
)

@Serializable
data class SessionResponse(
    val token: String,
    val user: User,
    val profileComplete: Boolean? = null,
    val missingFields: List<String>? = null
)

@Serializable
data class UserResponse(
    val user: User
)

// API Error
@Serializable
data class ApiError(
    val message: String,
    val code: Int? = null,
    val details: String? = null
)

// Common API response wrapper
@Serializable
data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: ApiError? = null,
    val message: String? = null
)
