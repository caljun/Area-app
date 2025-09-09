package com.anonymous.areaapp.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable
import java.util.Date

@Serializable
@Parcelize
data class User(
    val id: String,
    val email: String,
    val areaId: String? = null,
    val name: String? = null,
    val profileImage: String? = null,
    val createdAt: String, // ISO 8601 string format
    val updatedAt: String? = null,
    
    // Local state
    var isFriend: Boolean = false,
    var friendshipStatus: FriendshipStatus = FriendshipStatus.NONE,
    var isOnline: Boolean = false
) : Parcelable {
    
    // Helper method to get display name
    fun getDisplayName(): String {
        return name ?: "不明なユーザー"
    }
}

@Serializable
enum class FriendshipStatus(val value: String) {
    NONE("none"),
    PENDING("pending"),
    ACCEPTED("accepted"),
    REJECTED("rejected");
    
    fun getDisplayText(): String {
        return when (this) {
            NONE -> "友達ではない"
            PENDING -> "申請中"
            ACCEPTED -> "友達"
            REJECTED -> "拒否済み"
        }
    }
    
    fun getColor(): String {
        return when (this) {
            NONE -> "gray"
            PENDING -> "orange"
            ACCEPTED -> "green"
            REJECTED -> "red"
        }
    }
}
