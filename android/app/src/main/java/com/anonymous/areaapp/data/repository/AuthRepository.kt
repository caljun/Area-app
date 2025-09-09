package com.anonymous.areaapp.data.repository

import com.anonymous.areaapp.data.api.ApiClient
import com.anonymous.areaapp.data.api.safeApiCall
import com.anonymous.areaapp.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

class AuthRepository {
    
    suspend fun appleSignIn(token: String, userID: String, email: String?, fullName: String?): Flow<ApiResult<AuthResponse>> = flow {
        emit(ApiResult.Loading)
        
        val request = mutableMapOf<String, Any>(
            "identityToken" to token,
            "userID" to userID
        )
        
        email?.let { request["email"] = it }
        fullName?.let { request["name"] = it }
        
        val result = safeApiCall { ApiClient.apiService.appleSignIn(request) }
        emit(result)
    }
    
    suspend fun signUp(email: String, password: String, username: String, areaID: String, profileImage: File?): Flow<ApiResult<AuthResponse>> = flow {
        emit(ApiResult.Loading)
        
        val imagePart = profileImage?.let { file ->
            val requestFile = file.asRequestBody("image/jpeg".toMediaType())
            MultipartBody.Part.createFormData("profileImage", file.name, requestFile)
        }
        
        val result = safeApiCall { 
            ApiClient.apiService.signUp(email, password, username, areaID, imagePart) 
        }
        emit(result)
    }
    
    suspend fun validateToken(token: String): Flow<ApiResult<SessionResponse>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.validateToken("Bearer $token") }
        emit(result)
    }
    
    suspend fun updateProfile(token: String, name: String?, areaId: String?, profileImage: File?): Flow<ApiResult<SessionResponse>> = flow {
        emit(ApiResult.Loading)
        
        val imagePart = profileImage?.let { file ->
            val requestFile = file.asRequestBody("image/jpeg".toMediaType())
            MultipartBody.Part.createFormData("profileImage", file.name, requestFile)
        }
        
        val result = safeApiCall { 
            ApiClient.apiService.updateProfile("Bearer $token", name, areaId, imagePart) 
        }
        emit(result)
    }
    
    suspend fun healthCheck(): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.healthCheck() }
        emit(result)
    }
}
