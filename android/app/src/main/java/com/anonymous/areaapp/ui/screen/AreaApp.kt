package com.anonymous.areaapp.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.anonymous.areaapp.ui.viewmodel.AuthState
import com.anonymous.areaapp.ui.viewmodel.AuthViewModel

@Composable
fun AreaApp(
    modifier: Modifier = Modifier,
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by authViewModel.uiState.collectAsState()
    
    when (uiState.authState) {
        AuthState.UNAUTHENTICATED -> {
            AuthScreen(
                modifier = modifier,
                authViewModel = authViewModel
            )
        }
        AuthState.AUTHENTICATING -> {
            LoadingScreen(
                modifier = modifier,
                message = "認証中..."
            )
        }
        AuthState.ONBOARDING -> {
            OnboardingScreen(
                modifier = modifier,
                authViewModel = authViewModel
            )
        }
        AuthState.AUTHENTICATED -> {
            MainTabScreen(
                modifier = modifier
            )
        }
    }
    
    // Show error dialog if there's an error
    uiState.errorMessage?.let { errorMessage ->
        AlertDialog(
            onDismissRequest = { authViewModel.clearError() },
            title = { Text("エラー") },
            text = { Text(errorMessage) },
            confirmButton = {
                TextButton(onClick = { authViewModel.clearError() }) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
fun LoadingScreen(
    modifier: Modifier = Modifier,
    message: String = "読み込み中..."
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CircularProgressIndicator()
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center
            )
        }
    }
}
