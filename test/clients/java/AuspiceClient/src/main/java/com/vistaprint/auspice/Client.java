package com.vistaprint.auspice;

import com.google.api.client.auth.oauth.OAuthHmacSigner;
import com.google.api.client.auth.oauth.OAuthParameters;
import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.HttpRequestFactory;
import com.google.api.client.http.HttpResponse;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;

public class Client {
	private static final String CONSUMER_KEY = "super-insecure-test-key";
	private static final String CONSUMER_SECRET = "super-insecure-secret";

	public static void main(String[] args) throws Exception {
		HttpTransport transport = new NetHttpTransport();

		OAuthHmacSigner signer = new OAuthHmacSigner();
		signer.clientSharedSecret = CONSUMER_SECRET;

		OAuthParameters params = new OAuthParameters();
		params.consumerKey = CONSUMER_KEY;
		params.signer = signer;

		// utilize accessToken to access protected resources
		HttpRequestFactory factory = transport.createRequestFactory(params);
		GenericUrl url = new GenericUrl("http://localhost:8000/job");
		HttpRequest req = factory.buildGetRequest(url);
		HttpResponse resp = req.execute();
		System.out.println("Response Status Code: " + resp.getStatusCode());
		System.out.println("Response body:" + resp.parseAsString());
	}
}