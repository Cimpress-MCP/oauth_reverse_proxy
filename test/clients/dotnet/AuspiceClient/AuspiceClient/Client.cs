using DotNetOpenAuth.Messaging;
using DotNetOpenAuth.OAuth;
using DotNetOpenAuth.OAuth.ChannelElements;
using DotNetOpenAuth.OAuth.Messages;

using System;
using System.Collections.Generic;

namespace AuspiceClient
{
    public class ZeroLeggedTokenManager : IConsumerTokenManager
    {
        private string _consumerKey;
        private string _consumerSecret;

        public ZeroLeggedTokenManager(string consumerKey, string consumerSecret)
        {
            _consumerKey = consumerKey;
            _consumerSecret = consumerSecret;
        }

        public string ConsumerKey { get { return _consumerKey; } }

        public string ConsumerSecret { get { return _consumerSecret; } }

        public void ExpireRequestTokenAndStoreNewAccessToken(string consumerKey, string requestToken, string accessToken, string accessTokenSecret)
        {
            throw new NotImplementedException();
        }

        public string GetTokenSecret(string token)
        {
            //In a 0-legged conversation only the consumer secret is used to sign the message
            return "";
        }

        public TokenType GetTokenType(string token)
        {
            throw new NotImplementedException();
        }

        public void StoreNewRequestToken(DotNetOpenAuth.OAuth.Messages.UnauthorizedTokenRequest request, DotNetOpenAuth.OAuth.Messages.ITokenSecretContainingMessage response)
        {
            throw new NotImplementedException();
        }
    }

    class Client
    {
        static void Main(string[] args)
        {
            var providerDesc = new ServiceProviderDescription()
            {
                RequestTokenEndpoint = new MessageReceivingEndpoint("http://localhost:8000/noop", HttpDeliveryMethods.PostRequest),
                AccessTokenEndpoint = new MessageReceivingEndpoint("http://localhost:8000/noop", HttpDeliveryMethods.PostRequest),
                UserAuthorizationEndpoint = new MessageReceivingEndpoint("http://localhost:8000/noop", HttpDeliveryMethods.PostRequest),
                ProtocolVersion = ProtocolVersion.V10a,
                TamperProtectionElements = new ITamperProtectionChannelBindingElement[] { new HmacSha1SigningBindingElement() }
            };

            var zeroLeggedWebConsumer = new DotNetOpenAuth.OAuth.WebConsumer(providerDesc, new ZeroLeggedTokenManager("super-insecure-test-key", "super-insecure-secret"));

            var endpoint = new MessageReceivingEndpoint("http://10.95.251.69:8000/job?query=parameters&also=good", HttpDeliveryMethods.AuthorizationHeaderRequest | HttpDeliveryMethods.PostRequest);
            var httpRequest = zeroLeggedWebConsumer.PrepareAuthorizedRequest(endpoint, "DUMMY", new Dictionary<String, String>()
            {
                {"are", "post"},
                {"parameters", "handled"},
            });

            var response = httpRequest.GetResponse();
            var responseContent = new System.IO.StreamReader(response.GetResponseStream()).ReadToEnd();
            Console.Out.WriteLine(responseContent);
        }
    }
}
