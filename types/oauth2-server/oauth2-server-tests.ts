import express = require("express");
import OAuth2Server = require("oauth2-server");

const oauth2Model: OAuth2Server.AuthorizationCodeModel = {
    generateAuthorizationCode: async (client, user, scope) => {
        return JSON.stringify({
            client,
            user,
            scope,
        });
    },
    getClient: async (
        clientId: string,
        clientSecret: string,
    ): Promise<OAuth2Server.Client | OAuth2Server.Falsey> => {
        return undefined;
    },
    saveToken: async (
        token: OAuth2Server.Token,
        client: OAuth2Server.Client,
        user: OAuth2Server.User,
    ): Promise<OAuth2Server.Token> => {
        return token;
    },
    getAccessToken: async (accessToken: string): Promise<OAuth2Server.Token> => {
        return {
            accessToken,
            client: { id: "testClient", grants: ["access_token"] },
            user: { id: "testUser" },
        };
    },
    verifyScope: async (
        token: OAuth2Server.Token,
        scope: string,
    ): Promise<boolean> => {
        return true;
    },
    getAuthorizationCode: async (
        authorizationCode: string,
    ): Promise<OAuth2Server.AuthorizationCode> => {
        return {
            authorizationCode,
            expiresAt: new Date(),
            redirectUri: "www.test.com",
            client: { id: "testClient", grants: ["access_token"] },
            user: { id: "testUser" },
        };
    },
    saveAuthorizationCode: async (
        code,
        client: OAuth2Server.Client,
        user: OAuth2Server.User,
    ): Promise<OAuth2Server.AuthorizationCode> => {
        return { ...code, user, client };
    },
    revokeAuthorizationCode: async (
        code: OAuth2Server.AuthorizationCode,
    ): Promise<boolean> => {
        return true;
    },
};

const oauth2Server = new OAuth2Server({
    model: oauth2Model,
});

// Authenticate user with supplied bearer token
const authenticate = (authenticateOptions?: {}) => {
    const options: undefined | {} = authenticateOptions || {};
    return async (
        req: express.Request & { user: OAuth2Server.Token },
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const request = new OAuth2Server.Request(req);
        const response = new OAuth2Server.Response(res);

        try {
            // Test async method of accessing oauth2Server
            const token = await oauth2Server.authenticate(request, response, options);
            req.user = token;
            next();
        } catch (err) {
            res.status(err.code || 500).json(err);
        }
    };
};

const app = express();
app.all("/oauth2/token", (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    oauth2Server.token(request, response)
        .then((token: OAuth2Server.Token) => {
            res.json(token);
        }).catch((err: any) => {
            res.status(err.code || 500).json(err);
        });
});

app.post("/oauth2/authorize", (req, res) => {
    const request = new OAuth2Server.Request(req);
    const response = new OAuth2Server.Response(res);

    oauth2Server.authorize(request, response)
        .then((success: OAuth2Server.AuthorizationCode) => {
            res.json(success);
        }).catch((err: any) => {
            res.status(err.code || 500).json(err);
        });
});

app.get(
    "/secure",
    authenticate(),
    (req: express.Request & { user: OAuth2Server.Token }, res: express.Response, next: express.NextFunction) => {
        res.json({ message: "Secure data" });
    },
);

app.get(
    "/profile",
    authenticate({ scope: "profile" }),
    (req: express.Request & { user: OAuth2Server.Token }, res: express.Response, next: express.NextFunction) => {
        res.json({
            profile: req.user,
        });
    },
);

app.listen(3000);

class CustomGrantType extends OAuth2Server.AbstractGrantType {
    constructor(opts: OAuth2Server.AbstractGrantOptions) {
        super(opts);
    }

    async handle(request: OAuth2Server.Request, client: OAuth2Server.Client) {
        if (!request) throw new OAuth2Server.InvalidArgumentError("Missing `request`");
        if (!client) throw new OAuth2Server.InvalidArgumentError("Missing `client`");

        const scope = this.getScope(request);
        const user = {};

        return this.saveToken(user, client, scope);
    }

    async saveToken(
        user: OAuth2Server.User,
        client: OAuth2Server.Client,
        scope: string,
    ): Promise<OAuth2Server.Token | OAuth2Server.Falsey> {
        this.validateScope(user, client, scope);

        let token: OAuth2Server.PartialToken = {
            accessToken: await this.generateAccessToken(client, user, scope),
            accessTokenExpiresAt: this.getAccessTokenExpiresAt(),
            refreshToken: await this.generateRefreshToken(client, user, scope),
            refreshTokenExpiresAt: this.getRefreshTokenExpiresAt(),
            scope,
        };

        return this.model.saveToken(token, client, user);
    }
}
