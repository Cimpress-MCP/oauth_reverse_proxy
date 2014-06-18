using DotNetOpenAuth.Messaging;
using DotNetOpenAuth.OAuth;
using DotNetOpenAuth.OAuth.ChannelElements;
using DotNetOpenAuth.OAuth.Messages;

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;

namespace Client
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
                RequestTokenEndpoint = new MessageReceivingEndpoint("http://localhost:8008/noop", HttpDeliveryMethods.PostRequest),
                AccessTokenEndpoint = new MessageReceivingEndpoint("http://localhost:8008/noop", HttpDeliveryMethods.PostRequest),
                UserAuthorizationEndpoint = new MessageReceivingEndpoint("http://localhost:8008/noop", HttpDeliveryMethods.PostRequest),
                ProtocolVersion = ProtocolVersion.V10a,
                TamperProtectionElements = new ITamperProtectionChannelBindingElement[] { new HmacSha1SigningBindingElement() }
            };

            var consumerKey = "dotnet-test-key";
            var consumerSecret = File.ReadAllText("..\\..\\keys\\8008\\8080\\" + consumerKey);

            var zeroLeggedWebConsumer = new DotNetOpenAuth.OAuth.WebConsumer(providerDesc, new ZeroLeggedTokenManager(consumerKey, consumerSecret));

            var endpoint = new MessageReceivingEndpoint("http://localhost:8008/job?query=parameters&also=good", HttpDeliveryMethods.AuthorizationHeaderRequest | HttpDeliveryMethods.PostRequest);
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
