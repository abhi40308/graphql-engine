package v2query

import (
	"bytes"
	"context"
	"io"
	"net/http"

	"github.com/hasura/graphql-engine/cli/internal/hasura/sourceops/mssql"
	"github.com/hasura/graphql-engine/cli/internal/hasura/sourceops/postgres"

	"github.com/hasura/graphql-engine/cli/internal/hasura"
	"github.com/hasura/graphql-engine/cli/internal/httpc"
)

type Client struct {
	*httpc.Client
	hasura.PGSourceOps
	hasura.MSSQLSourceOps
	path string
}

func New(c *httpc.Client, path string) *Client {
	client := &Client{
		Client:         c,
		PGSourceOps:    postgres.New(c, path),
		MSSQLSourceOps: mssql.New(c, path),
		path:           path,
	}
	return client
}

func (c *Client) Send(body interface{}) (*httpc.Response, io.Reader, error) {
	req, err := c.NewRequest(http.MethodPost, c.path, body)
	if err != nil {
		return nil, nil, err
	}
	var responseBody = new(bytes.Buffer)
	resp, err := c.LockAndDo(context.Background(), req, responseBody)
	if err != nil {
		return resp, nil, err
	}
	return resp, responseBody, nil
}
