package com.cimpress.mcp.jwt;

import java.io.File;
import java.io.FileInputStream;
import java.net.URL;
import java.util.LinkedList;
import java.util.List;

import org.apache.commons.io.IOUtils;
import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;
import org.jose4j.base64url.Base64;
import org.jose4j.jwk.JsonWebKey;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jws.JsonWebSignature;
import org.jose4j.jwt.JwtClaims;

public class JWTClient {
	private static final String CONSUMER_KEY = "java-test-key";

	public static void main(String[] args) throws Exception {
		
		File keyFile = new File("../../../keys/8008/8080/" + CONSUMER_KEY);
		String secret = Base64.encode(IOUtils.toString(new FileInputStream(keyFile)).getBytes());
		
		URL url = new URL("http://localhost:7070/job?this=is&fun=right");
		
		HttpPost request = new HttpPost(url.toURI());
		List<NameValuePair> params = new LinkedList<NameValuePair>();
		// NOTE: The below line doesn't work because Java SignPost can't handle query and post
		// params with the same name.
		// params.add(new BasicNameValuePair("this", "post"));
		params.add(new BasicNameValuePair("post", "happy"));
		params.add(new BasicNameValuePair("wow", "so"));
		params.add(new BasicNameValuePair("signposty", "a"));
		params.add(new BasicNameValuePair("signposty", "b"));
		params.add(new BasicNameValuePair("signposty", "rad"));
		//request.setEntity(new UrlEncodedFormEntity(params));

        // sign the request
		JwtClaims claims = new JwtClaims();
	    claims.setIssuer("java-test-key");
	    claims.setGeneratedJwtId();
	    claims.setExpirationTimeMinutesInTheFuture(1);
	    claims.setNotBeforeMinutesInThePast(1);
	    claims.setIssuedAtToNow();
	    
	    // A JWT is a JWS and/or a JWE with JSON claims as the payload.
	    // In this example it is a JWS so we create a JsonWebSignature object.
	    JsonWebSignature jws = new JsonWebSignature();

	    // The payload of the JWS is JSON content of the JWT Claims
	    jws.setPayload(claims.toJson());

	    // The JWT is signed using the private key
	    String jwkJson = "{\"kty\":\"oct\",\"k\":\""+ secret +"\"}";
	    JsonWebKey key = JsonWebKey.Factory.newJwk(jwkJson);
	    jws.setKey(key.getKey());
	    jws.setKeyIdHeaderValue(key.getKeyId());
	    jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.HMAC_SHA256);

	    String jwt = jws.getCompactSerialization();
	    
	    request.setHeader("Authorization", "Bearer " + jwt);
		
        // send the request
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpResponse response = httpClient.execute(request);
		
		// Print the result
		System.out.println(IOUtils.toString(response.getEntity().getContent()));
	}
}