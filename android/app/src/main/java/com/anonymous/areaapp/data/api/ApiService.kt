package com.anonymous.areaapp.data.api

import com.anonymous.areaapp.data.model.*
import retrofit2.Response
import retrofit2.http.*
import okhttp3.MultipartBody

interface ApiService {
    
    // Authentication endpoints
    @POST("auth/apple")
    suspend fun appleSignIn(@Body request: Map<String, Any>): Response<AuthResponse>
    
    @POST("auth/register")
    @Multipart
    suspend fun signUp(@Part("email") email: String,
                       @Part("password") password: String,
                       @Part("username") username: String,
                       @Part("areaId") areaId: String,
                       @Part profileImage: okhttp3.MultipartBody.Part?): Response<AuthResponse>
    
    @GET("auth/me")
    suspend fun validateToken(@Header("Authorization") token: String): Response<SessionResponse>
    
    @PATCH("users/me")
    @Multipart
    suspend fun updateProfile(@Header("Authorization") token: String,
                              @Part("name") name: String?,
                              @Part("areaId") areaId: String?,
                              @Part profileImage: okhttp3.MultipartBody.Part?): Response<SessionResponse>
    
    @GET("health")
    suspend fun healthCheck(): Response<Unit>
    
    // Area endpoints
    @GET("areas")
    suspend fun getAreas(@Header("Authorization") token: String): Response<List<Area>>
    
    @GET("areas/public")
    suspend fun getPublicAreas(): Response<List<Area>>
    
    @GET("areas/{id}")
    suspend fun getArea(@Header("Authorization") token: String, @Path("id") id: String): Response<Area>
    
    @POST("areas")
    suspend fun createArea(@Header("Authorization") token: String, @Body request: CreateAreaRequest): Response<Area>
    
    @PATCH("areas/{id}")
    suspend fun updateArea(@Header("Authorization") token: String, 
                          @Path("id") id: String, 
                          @Body request: UpdateAreaRequest): Response<Area>
    
    @DELETE("areas/{id}")
    suspend fun deleteArea(@Header("Authorization") token: String, @Path("id") id: String): Response<Unit>
    
    @GET("areas/{id}/members")
    suspend fun getAreaMembers(@Header("Authorization") token: String, @Path("id") id: String): Response<List<User>>
    
    @POST("areas/{id}/invite")
    suspend fun inviteMemberToArea(@Header("Authorization") token: String, 
                                  @Path("id") id: String, 
                                  @Body request: AreaInviteRequest): Response<Unit>
    
    @GET("areas/invites")
    suspend fun getAreaInvites(@Header("Authorization") token: String): Response<List<AreaInvite>>
    
    @PATCH("areas/invites/{id}")
    suspend fun respondToAreaInvite(@Header("Authorization") token: String, 
                                   @Path("id") id: String, 
                                   @Body request: RespondToAreaInviteRequest): Response<Unit>
    
    @DELETE("areas/{id}/members/{userId}")
    suspend fun removeMemberFromArea(@Header("Authorization") token: String, 
                                    @Path("id") id: String, 
                                    @Path("userId") userId: String): Response<Unit>
    
    @POST("areas/{id}/join")
    suspend fun joinArea(@Header("Authorization") token: String, @Path("id") id: String): Response<Unit>
    
    @POST("areas/{id}/leave")
    suspend fun leaveArea(@Header("Authorization") token: String, @Path("id") id: String): Response<Unit>
    
    @GET("areas/search")
    suspend fun searchAreas(@Header("Authorization") token: String, @Query("q") query: String): Response<List<Area>>
    
    @GET("areas/nearby")
    suspend fun getNearbyAreas(@Header("Authorization") token: String, 
                              @Query("lat") latitude: Double, 
                              @Query("lng") longitude: Double, 
                              @Query("radius") radius: Double = 5000.0): Response<List<Area>>
    
    // Friends endpoints
    @GET("friends")
    suspend fun getFriends(@Header("Authorization") token: String): Response<List<Friend>>
    
    @GET("friends/requests")
    suspend fun getFriendRequests(@Header("Authorization") token: String): Response<List<FriendRequest>>
    
    @POST("friends/requests")
    suspend fun createFriendRequest(@Header("Authorization") token: String, 
                                   @Body request: CreateFriendRequestRequest): Response<FriendRequest>
    
    @PATCH("friends/requests/{id}")
    suspend fun respondToFriendRequest(@Header("Authorization") token: String, 
                                      @Path("id") id: String, 
                                      @Body request: RespondToFriendRequestRequest): Response<Unit>
    
    @POST("friends/search")
    suspend fun searchUsers(@Header("Authorization") token: String, 
                           @Body request: SearchUserRequest): Response<List<User>>
    
    // Chat endpoints
    @GET("chats")
    suspend fun getChats(@Header("Authorization") token: String): Response<List<Chat>>
    
    @POST("chats")
    suspend fun createChat(@Header("Authorization") token: String, 
                           @Body request: CreateChatRequest): Response<Chat>
    
    @GET("chats/{id}/messages")
    suspend fun getMessages(@Header("Authorization") token: String, 
                           @Path("id") id: String): Response<List<Message>>
    
    @POST("chats/{id}/messages")
    suspend fun sendMessage(@Header("Authorization") token: String, 
                           @Path("id") id: String, 
                           @Body request: SendMessageRequest): Response<Message>
    
    @PATCH("messages/{id}/read")
    suspend fun markMessageAsRead(@Header("Authorization") token: String, 
                                 @Path("id") id: String): Response<Unit>
}
