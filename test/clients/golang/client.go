package main

import (
		"fmt"
		"github.com/mrjones/oauth"
		"io/ioutil"
		"log"
)

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func main() {
	var consumerKey string = "golang-test-key"
	var consumerSecretPath string = "../../../../keys/8008/8080/" + consumerKey
	secret, err := ioutil.ReadFile(consumerSecretPath)
	check(err)
	consumerSecret := string(secret)

	c := oauth.NewConsumer(
							consumerKey,
							consumerSecret,
							oauth.ServiceProvider {
								RequestTokenUrl: "",
								AuthorizeTokenUrl: "",
								AccessTokenUrl: "",
								})

	//c.Debug(true)

	var emptyAccessToken oauth.AccessToken

	response, err := c.Get(
		"http://localhost:8008/job/12345",
		map[string]string{},
		&emptyAccessToken)
	if err != nil {
		log.Fatal(err)
	}
	
	defer response.Body.Close()

	bits, err := ioutil.ReadAll(response.Body)
	fmt.Println(string(bits))
}