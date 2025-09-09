package com.anonymous.areaapp.data.repository

import com.anonymous.areaapp.data.api.ApiClient
import com.anonymous.areaapp.data.api.safeApiCall
import com.anonymous.areaapp.data.model.*
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class AreaRepository {
    
    suspend fun getAreas(token: String): Flow<ApiResult<List<Area>>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.getAreas("Bearer $token") }
        emit(result)
    }
    
    suspend fun getPublicAreas(): Flow<ApiResult<List<Area>>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.getPublicAreas() }
        emit(result)
    }
    
    suspend fun getArea(token: String, id: String): Flow<ApiResult<Area>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.getArea("Bearer $token", id) }
        emit(result)
    }
    
    suspend fun createArea(token: String, name: String, coordinates: List<LatLng>, isPublic: Boolean = false): Flow<ApiResult<Area>> = flow {
        emit(ApiResult.Loading)
        
        val coordinateData = coordinates.map { coord ->
            Coordinate(coord.latitude, coord.longitude)
        }
        
        val request = CreateAreaRequest(name, coordinateData, isPublic)
        val result = safeApiCall { ApiClient.apiService.createArea("Bearer $token", request) }
        emit(result)
    }
    
    suspend fun updateArea(token: String, id: String, name: String?, coordinates: List<LatLng>?, isPublic: Boolean?): Flow<ApiResult<Area>> = flow {
        emit(ApiResult.Loading)
        
        val coordinateData = coordinates?.map { coord ->
            Coordinate(coord.latitude, coord.longitude)
        }
        
        val request = UpdateAreaRequest(name, coordinateData, isPublic)
        val result = safeApiCall { ApiClient.apiService.updateArea("Bearer $token", id, request) }
        emit(result)
    }
    
    suspend fun deleteArea(token: String, id: String): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.deleteArea("Bearer $token", id) }
        emit(result)
    }
    
    suspend fun getAreaMembers(token: String, areaId: String): Flow<ApiResult<List<User>>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.getAreaMembers("Bearer $token", areaId) }
        emit(result)
    }
    
    suspend fun inviteMemberToArea(token: String, areaId: String, userId: String): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val request = AreaInviteRequest(areaId, userId)
        val result = safeApiCall { ApiClient.apiService.inviteMemberToArea("Bearer $token", areaId, request) }
        emit(result)
    }
    
    suspend fun getAreaInvites(token: String): Flow<ApiResult<List<AreaInvite>>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.getAreaInvites("Bearer $token") }
        emit(result)
    }
    
    suspend fun respondToAreaInvite(token: String, inviteId: String, action: String): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val request = RespondToAreaInviteRequest(action)
        val result = safeApiCall { ApiClient.apiService.respondToAreaInvite("Bearer $token", inviteId, request) }
        emit(result)
    }
    
    suspend fun removeMemberFromArea(token: String, areaId: String, userId: String): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.removeMemberFromArea("Bearer $token", areaId, userId) }
        emit(result)
    }
    
    suspend fun joinArea(token: String, areaId: String): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.joinArea("Bearer $token", areaId) }
        emit(result)
    }
    
    suspend fun leaveArea(token: String, areaId: String): Flow<ApiResult<Unit>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.leaveArea("Bearer $token", areaId) }
        emit(result)
    }
    
    suspend fun searchAreas(token: String, query: String): Flow<ApiResult<List<Area>>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.searchAreas("Bearer $token", query) }
        emit(result)
    }
    
    suspend fun getNearbyAreas(token: String, latitude: Double, longitude: Double, radius: Double = 5000.0): Flow<ApiResult<List<Area>>> = flow {
        emit(ApiResult.Loading)
        val result = safeApiCall { ApiClient.apiService.getNearbyAreas("Bearer $token", latitude, longitude, radius) }
        emit(result)
    }
}
