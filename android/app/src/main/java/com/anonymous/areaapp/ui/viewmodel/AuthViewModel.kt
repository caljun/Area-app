package com.anonymous.areaapp.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.anonymous.areaapp.data.api.ApiResult
import com.anonymous.areaapp.data.model.*
import com.anonymous.areaapp.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

enum class AuthState {
    UNAUTHENTICATED,
    AUTHENTICATING,
    ONBOARDING,
    AUTHENTICATED
}

data class AuthUiState(
    val authState: AuthState = AuthState.UNAUTHENTICATED,
    val currentUser: User? = null,
    val authToken: String? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class AuthViewModel : ViewModel() {
    
    private val authRepository = AuthRepository()
    
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    init {
        // Restore app state on initialization
        restoreAppState()
    }
    
    private fun restoreAppState() {
        // TODO: Implement state restoration from DataStore
        // For now, set to unauthenticated
        _uiState.value = _uiState.value.copy(authState = AuthState.UNAUTHENTICATED)
    }
    
    fun signUp(email: String, password: String, username: String, areaID: String, profileImage: File?) {
        _uiState.value = _uiState.value.copy(
            authState = AuthState.AUTHENTICATING,
            isLoading = true,
            errorMessage = null
        )
        
        viewModelScope.launch {
            authRepository.signUp(email, password, username, areaID, profileImage)
                .collect { result ->
                    when (result) {
                        is ApiResult.Loading -> {
                            _uiState.value = _uiState.value.copy(isLoading = true)
                        }
                        is ApiResult.Success -> {
                            handleAuthSuccess(result.data)
                        }
                        is ApiResult.Error -> {
                            handleAuthError(result.exception)
                        }
                    }
                }
        }
    }
    
    fun appleSignIn(token: String, userID: String, email: String?, fullName: String?) {
        _uiState.value = _uiState.value.copy(
            authState = AuthState.AUTHENTICATING,
            isLoading = true,
            errorMessage = null
        )
        
        viewModelScope.launch {
            authRepository.appleSignIn(token, userID, email, fullName)
                .collect { result ->
                    when (result) {
                        is ApiResult.Loading -> {
                            _uiState.value = _uiState.value.copy(isLoading = true)
                        }
                        is ApiResult.Success -> {
                            handleAuthSuccess(result.data)
                        }
                        is ApiResult.Error -> {
                            handleAuthError(result.exception)
                        }
                    }
                }
        }
    }
    
    fun updateProfile(name: String?, areaId: String?, profileImage: File?) {
        val token = _uiState.value.authToken ?: return
        
        viewModelScope.launch {
            authRepository.updateProfile(token, name, areaId, profileImage)
                .collect { result ->
                    when (result) {
                        is ApiResult.Loading -> {
                            _uiState.value = _uiState.value.copy(isLoading = true)
                        }
                        is ApiResult.Success -> {
                            handleProfileUpdate(result.data)
                        }
                        is ApiResult.Error -> {
                            handleAuthError(result.exception)
                        }
                    }
                }
        }
    }
    
    fun signOut() {
        // TODO: Clear stored token from DataStore
        _uiState.value = AuthUiState(authState = AuthState.UNAUTHENTICATED)
    }
    
    private fun handleAuthSuccess(response: AuthResponse) {
        val newState = _uiState.value.copy(
            authToken = response.token,
            currentUser = response.user,
            isLoading = false,
            errorMessage = null
        )
        
        // Determine auth state based on profile completion
        val authState = if (response.isNewUser == true || response.profileComplete == false) {
            AuthState.ONBOARDING
        } else {
            AuthState.AUTHENTICATED
        }
        
        _uiState.value = newState.copy(authState = authState)
        
        // TODO: Save token to DataStore
    }
    
    private fun handleProfileUpdate(response: SessionResponse) {
        _uiState.value = _uiState.value.copy(
            currentUser = response.user,
            isLoading = false,
            errorMessage = null
        )
        
        // Determine auth state based on profile completion
        val authState = if (response.profileComplete == true) {
            AuthState.AUTHENTICATED
        } else {
            AuthState.ONBOARDING
        }
        
        _uiState.value = _uiState.value.copy(authState = authState)
    }
    
    private fun handleAuthError(exception: Throwable) {
        _uiState.value = _uiState.value.copy(
            authState = AuthState.UNAUTHENTICATED,
            isLoading = false,
            errorMessage = exception.message ?: "認証エラーが発生しました"
        )
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}
