package com.cimpress.mcp.oauth;

import java.io.File;
import java.io.FileInputStream;
import java.net.URL;
import java.util.LinkedList;
import java.util.List;

import org.apache.commons.io.IOUtils;
import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.message.BasicNameValuePair;

import oauth.signpost.OAuthConsumer;
import oauth.signpost.commonshttp.CommonsHttpOAuthConsumer;

public class OAuthClient {
	private static final String CONSUMER_KEY = "java-test-key";

	public static void main(String[] args) throws Exception {
		
		File consumerKeyFile = new File("../../../keys/8008/8080/" + CONSUMER_KEY);
		String consumerSecret = IOUtils.toString(new FileInputStream(consumerKeyFile));
		
		OAuthConsumer consumer = new CommonsHttpOAuthConsumer(CONSUMER_KEY, consumerSecret);

		URL url = new URL("http://localhost:8008/job?this=is&fun=right");
		
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
		request.setEntity(new UrlEncodedFormEntity(params));

        // sign the request
        consumer.sign(request);

        // send the request
        HttpClient httpClient = new DefaultHttpClient();
        HttpResponse response = httpClient.execute(request);
		
		// Print the result
		System.out.println(IOUtils.toString(response.getEntity().getContent()));
	}
}
