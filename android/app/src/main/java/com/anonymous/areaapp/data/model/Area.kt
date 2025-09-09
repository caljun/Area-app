package com.anonymous.areaapp.data.model

import android.os.Parcelable
import com.google.android.gms.maps.model.LatLng
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable

@Serializable
@Parcelize
data class Area(
    val id: String,
    val name: String,
    val coordinates: List<Coordinate>,
    val userId: String,
    val isPublic: Boolean,
    val imageUrl: String? = null,
    val createdAt: String, // ISO 8601 string format
    val updatedAt: String, // ISO 8601 string format
    val memberCount: Int = 0,
    val onlineCount: Int = 0,
    
    // Local state
    var isSelected: Boolean = false,
    var distance: Double? = null
) : Parcelable {
    
    // Calculate center coordinate
    fun getCenterCoordinate(): LatLng {
        val avgLat = coordinates.map { it.latitude }.average()
        val avgLng = coordinates.map { it.longitude }.average()
        return LatLng(avgLat, avgLng)
    }
    
    // Calculate approximate area (simplified)
    fun getApproximateArea(): Double {
        return coordinates.size * 100.0 // Simplified calculation
    }
}

@Serializable
@Parcelize
data class Coordinate(
    val latitude: Double,
    val longitude: Double
) : Parcelable {
    
    fun toLatLng(): LatLng {
        return LatLng(latitude, longitude)
    }
}

// Request models
@Serializable
data class CreateAreaRequest(
    val name: String,
    val coordinates: List<Coordinate>,
    val isPublic: Boolean
)

@Serializable
data class UpdateAreaRequest(
    val name: String? = null,
    val coordinates: List<Coordinate>? = null,
    val isPublic: Boolean? = null
)

@Serializable
data class AreaInviteRequest(
    val areaId: String,
    val userId: String
)

@Serializable
@Parcelize
data class AreaInvite(
    val id: String,
    val areaId: String,
    val areaName: String? = null,
    val fromUserId: String,
    val toUserId: String,
    val status: AreaInviteStatus,
    val createdAt: String, // ISO 8601 string format
    val updatedAt: String? = null
) : Parcelable

@Serializable
enum class AreaInviteStatus(val value: String) {
    PENDING("pending"),
    ACCEPTED("accepted"),
    REJECTED("rejected"),
    CANCELLED("cancelled")
}

@Serializable
data class RespondToAreaInviteRequest(
    val action: String // "accept" or "reject"
)
