using System;
using System.IO;

using RestSharp;
using RestSharp.Authenticators;

namespace RestSharpClient
{
    class Program
    {
        static void Main(string[] args)
        {
            var consumerKey = "restsharp-test-key";
            var consumerSecret = File.ReadAllText("..\\..\\keys\\8008\\8080\\" + consumerKey);

            RestClient client = new RestClient("http://localhost:8008/")
                                    {
                                        Authenticator =
                                            OAuth1Authenticator
                                            .ForProtectedResource(
                                                consumerKey,
                                                consumerSecret,
                                                string.Empty,
                                                string.Empty)
                                    };

            var restRequest = new RestRequest("job", Method.POST);
            restRequest.AddParameter("are", "post", ParameterType.GetOrPost);
            restRequest.AddParameter("parameters", "handled", ParameterType.GetOrPost);

            var response = client.Execute(restRequest);
            Console.Out.WriteLine(response.Content);
        }
    }
}
