package com.anonymous.areaapp.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.anonymous.areaapp.ui.viewmodel.AuthViewModel

@Composable
fun OnboardingScreen(
    modifier: Modifier = Modifier,
    authViewModel: AuthViewModel
) {
    var username by remember { mutableStateOf("") }
    var areaId by remember { mutableStateOf("") }
    var currentStep by remember { mutableStateOf(0) }
    
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "プロフィール設定",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        when (currentStep) {
            0 -> {
                // Username step
                Text(
                    text = "ユーザー名を設定してください",
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("ユーザー名") },
                    modifier = Modifier.fillMaxWidth()
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Button(
                    onClick = { currentStep = 1 },
                    enabled = username.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("次へ")
                }
            }
            1 -> {
                // Area ID step
                Text(
                    text = "Area IDを設定してください",
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                OutlinedTextField(
                    value = areaId,
                    onValueChange = { areaId = it },
                    label = { Text("Area ID") },
                    modifier = Modifier.fillMaxWidth()
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { currentStep = 0 },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("戻る")
                    }
                    
                    Button(
                        onClick = { 
                            authViewModel.updateProfile(username, areaId, null)
                        },
                        enabled = areaId.isNotBlank(),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("完了")
                    }
                }
            }
        }
    }
}
