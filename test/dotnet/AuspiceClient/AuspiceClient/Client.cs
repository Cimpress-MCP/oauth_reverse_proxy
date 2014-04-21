using DotNetOpenAuth.Messaging;
using DotNetOpenAuth.OAuth;
using DotNetOpenAuth.OAuth.ChannelElements;
using DotNetOpenAuth.OAuth.Messages;

using System;

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

            var response = zeroLeggedWebConsumer.PrepareAuthorizedRequestAndSend(
                new MessageReceivingEndpoint("http://localhost:8000/job",
                   HttpDeliveryMethods.GetRequest), "DUMMY");
            using (var reader = new System.IO.StreamReader(response.ResponseStream))
            {
                char[] buffer = new char[1024];
                int read = 0;
                int i = 0;
                do
                {
                    read = reader.Read(buffer, 0, buffer.Length);
                    Console.Write("{0}", new String(buffer, 0, read));
                } while (!reader.EndOfStream);
            }
        }
    }
}
