package com.anonymous.areaapp.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable

@Serializable
@Parcelize
data class Friend(
    val id: String,
    val userId: String,
    val friendId: String,
    val status: FriendshipStatus,
    val createdAt: String, // ISO 8601 string format
    val updatedAt: String? = null,
    
    // Related data
    var user: User? = null,
    var friend: User? = null
) : Parcelable

@Serializable
@Parcelize
data class FriendRequest(
    val id: String,
    val fromUserId: String,
    val toUserId: String,
    val message: String? = null,
    val createdAt: String, // ISO 8601 string format
    val status: FriendRequestStatus,
    
    // Related data
    var fromUser: User? = null,
    var toUser: User? = null
) : Parcelable

@Serializable
enum class FriendRequestStatus(val value: String) {
    PENDING("pending"),
    ACCEPTED("accepted"),
    REJECTED("rejected"),
    CANCELLED("cancelled");
    
    fun getDisplayText(): String {
        return when (this) {
            PENDING -> "申請中"
            ACCEPTED -> "承認済み"
            REJECTED -> "拒否済み"
            CANCELLED -> "キャンセル済み"
        }
    }
    
    fun getColor(): String {
        return when (this) {
            PENDING -> "orange"
            ACCEPTED -> "green"
            REJECTED -> "red"
            CANCELLED -> "gray"
        }
    }
}

// Request models
@Serializable
data class CreateFriendRequestRequest(
    val toUserId: String,
    val message: String? = null
)

@Serializable
data class RespondToFriendRequestRequest(
    val requestId: String,
    val action: String // "accept" or "reject"
)

@Serializable
data class SearchUserRequest(
    val query: String, // Area ID or username
    val type: String // "areaId" or "username"
)
