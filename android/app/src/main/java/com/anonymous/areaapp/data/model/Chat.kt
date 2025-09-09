package com.anonymous.areaapp.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable

@Serializable
@Parcelize
data class Chat(
    val id: String,
    val participants: List<String>, // User IDs
    val lastMessage: Message? = null,
    val createdAt: String, // ISO 8601 string format
    val updatedAt: String, // ISO 8601 string format
    
    // Local state
    var unreadCount: Int = 0,
    var isOnline: Boolean = false
) : Parcelable {
    
    // Get other participant ID (excluding current user)
    fun getOtherParticipantId(myUserId: String): String? {
        return participants.firstOrNull { it != myUserId }
    }
    
    // Get display name for chat
    fun getDisplayName(myUserId: String, otherUser: User?): String {
        return otherUser?.getDisplayName() ?: "不明なユーザー"
    }
}

@Serializable
@Parcelize
data class Message(
    val id: String,
    val chatId: String,
    val senderId: String,
    val content: String,
    val messageType: MessageType,
    val createdAt: String, // ISO 8601 string format
    val updatedAt: String? = null,
    
    // Local state
    var isRead: Boolean = false,
    var isSending: Boolean = false,
    var isFailed: Boolean = false
) : Parcelable {
    
    // Get display time for message
    fun getDisplayTime(): String {
        // This would need proper date parsing in a real implementation
        return "12:34" // Placeholder
    }
}

@Serializable
enum class MessageType(val value: String) {
    TEXT("text"),
    IMAGE("image"),
    LOCATION("location"),
    AREA("area");
    
    fun getDisplayText(): String {
        return when (this) {
            TEXT -> "テキスト"
            IMAGE -> "画像"
            LOCATION -> "位置情報"
            AREA -> "エリア"
        }
    }
}

// Request models
@Serializable
data class CreateChatRequest(
    val participantIds: List<String>
)

@Serializable
data class SendMessageRequest(
    val chatId: String,
    val content: String,
    val messageType: MessageType
)

@Serializable
data class MarkMessageAsReadRequest(
    val messageId: String
)
